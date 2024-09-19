pub mod attachment;
pub mod fmt;

use crate::{
    dlt::fmt::FormattableMessage, someip::FibexMetadata as FibexSomeipMetadata, Error, LogMessage,
    ParseYield, Parser,
};
use byteorder::{BigEndian, WriteBytesExt};
use dlt_core::{
    dlt,
    parse::{dlt_consume_msg, dlt_message},
};
pub use dlt_core::{
    dlt::LogLevel,
    fibex::{gather_fibex_data, FibexConfig, FibexMetadata as FibexDltMetadata},
    filtering::{DltFilterConfig, ProcessedDltFilterConfig},
};
use serde::Serialize;
use std::{io::Write, ops::Range};

use self::{attachment::FtScanner, fmt::FormatOptions};

impl LogMessage for FormattableMessage<'_> {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let bytes = self.message.as_bytes();
        let len = bytes.len();
        writer.write_all(&bytes)?;
        Ok(len)
    }
}

#[derive(Debug, Serialize)]
pub struct RawMessage {
    pub content: Vec<u8>,
}

#[derive(Debug, Serialize)]
pub struct RangeMessage {
    pub range: Range<usize>,
}

impl std::fmt::Display for RangeMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "({:?})", self.range)
    }
}
impl std::fmt::Display for RawMessage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{:02X?}]", &self.content)
    }
}

impl LogMessage for RangeMessage {
    /// A RangeMessage only has range information and cannot serialize to bytes
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        writer.write_u64::<BigEndian>(self.range.start as u64)?;
        writer.write_u64::<BigEndian>(self.range.end as u64)?;
        Ok(8 + 8)
    }
}

impl LogMessage for RawMessage {
    fn to_writer<W: Write>(&self, writer: &mut W) -> Result<usize, std::io::Error> {
        let len = self.content.len();
        writer.write_all(&self.content)?;
        Ok(len)
    }
}

#[derive(Default)]
pub struct DltParser<'m> {
    pub filter_config: Option<ProcessedDltFilterConfig>,
    pub fibex_dlt_metadata: Option<&'m FibexDltMetadata>,
    pub fmt_options: Option<&'m FormatOptions>,
    pub with_storage_header: bool,
    ft_scanner: FtScanner,
    fibex_someip_metadata: Option<&'m FibexSomeipMetadata>,
    offset: usize,
}

#[derive(Default)]
pub struct DltRangeParser {
    offset: usize,
}

pub struct DltRawParser {
    pub with_storage_header: bool,
}

impl DltRawParser {
    pub fn new(with_storage_header: bool) -> Self {
        Self {
            with_storage_header,
        }
    }
}

impl DltRangeParser {
    pub fn new() -> Self {
        Self { offset: 0 }
    }
}

impl<'m> DltParser<'m> {
    pub fn new(
        filter_config: Option<ProcessedDltFilterConfig>,
        fibex_dlt_metadata: Option<&'m FibexDltMetadata>,
        fmt_options: Option<&'m FormatOptions>,
        fibex_someip_metadata: Option<&'m FibexSomeipMetadata>,
        with_storage_header: bool,
    ) -> Self {
        Self {
            filter_config,
            fibex_dlt_metadata,
            with_storage_header,
            fmt_options,
            ft_scanner: FtScanner::new(),
            fibex_someip_metadata,
            offset: 0,
        }
    }
}

impl<'m> Parser<FormattableMessage<'m>> for DltParser<'m> {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<ParseYield<FormattableMessage<'m>>>), Error> {
        match dlt_message(input, self.filter_config.as_ref(), self.with_storage_header).map_err(
            |e| match e {
                //TODO AAZ: Make it cleaner with From<>
                dlt_core::parse::DltParseError::Unrecoverable(e) => Error::Parse(format!("{e}")),
                dlt_core::parse::DltParseError::ParsingHickup(e) => Error::Parse(format!("{e}")),
                dlt_core::parse::DltParseError::IncompleteParse { needed: _ } => Error::Incomplete,
            },
        )? {
            (rest, dlt_core::parse::ParsedMessage::FilteredOut(_n)) => {
                self.offset += input.len() - rest.len();
                Ok((rest, None))
            }
            (_, dlt_core::parse::ParsedMessage::Invalid) => {
                Err(Error::Parse("Invalid parse".to_owned()))
            }
            (rest, dlt_core::parse::ParsedMessage::Item(i)) => {
                let attachment = self.ft_scanner.process(&i);
                let msg_with_storage_header = if i.storage_header.is_some() {
                    i
                } else {
                    i.add_storage_header(timestamp.map(dlt::DltTimeStamp::from_ms))
                };

                let msg = FormattableMessage {
                    message: msg_with_storage_header,
                    fibex_dlt_metadata: self.fibex_dlt_metadata,
                    options: self.fmt_options,
                    fibex_someip_metadata: self.fibex_someip_metadata,
                };
                self.offset += input.len() - rest.len();
                Ok((
                    rest,
                    if let Some(attachment) = attachment {
                        Some(ParseYield::MessageAndAttachment((msg, attachment)))
                    } else {
                        Some(ParseYield::Message(msg))
                    },
                ))
            }
        }
    }
}

impl Parser<RangeMessage> for DltRangeParser {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<ParseYield<RangeMessage>>), Error> {
        let (rest, consumed) = dlt_consume_msg(input).map_err(|e| Error::Parse(format!("{e}")))?;
        let msg = consumed.map(|c| {
            self.offset += c as usize;
            RangeMessage {
                range: Range {
                    start: self.offset,
                    end: self.offset + c as usize,
                },
            }
        });
        Ok((rest, msg.map(|m| m.into())))
    }
}

impl Parser<RawMessage> for DltRawParser {
    fn parse<'b>(
        &mut self,
        input: &'b [u8],
        _timestamp: Option<u64>,
    ) -> Result<(&'b [u8], Option<ParseYield<RawMessage>>), Error> {
        let (rest, consumed) = dlt_consume_msg(input).map_err(|e| Error::Parse(format!("{e}")))?;
        let msg = consumed.map(|c| RawMessage {
            content: Vec::from(&input[0..c as usize]),
        });
        Ok((rest, msg.map(|m| m.into())))
    }
}
