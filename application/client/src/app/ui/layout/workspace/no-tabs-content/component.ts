import { Component } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { FileType, File } from '@platform/types/files';
import { TabSourceMultipleFiles } from '@tabs/sources/multiplefiles/component';

@Component({
    selector: 'app-layout-area-no-tabs-content',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class LayoutWorkspaceNoContent {
    public readonly FileType = FileType;

    public ngStreaming(target: FileType) {
        switch (target) {
            case FileType.Dlt:
                this.ilc()
                    .services.system.opener.stream()
                    .dlt()
                    .catch((err: Error) => {
                        this.log().error(`Fail to open DLT stream; error: ${err.message}`);
                    });
                break;
            case FileType.Text:
                this.ilc()
                    .services.system.opener.stream()
                    .text()
                    .catch((err: Error) => {
                        this.log().error(`Fail to open text stream; error: ${err.message}`);
                    });
                break;
            default:
                break;
        }
    }

    public ngOpenFile(target: FileType) {
        const select = this.ilc().services.system.bridge.files().select;
        (() => {
            switch (target) {
                case FileType.Any:
                    return select.any();
                case FileType.Text:
                    return select.text();
                case FileType.Dlt:
                    return select.dlt();
                case FileType.Pcap:
                    return select.pcap();
                default:
                    return Promise.reject(new Error(`Unsupported file type`));
            }
        })()
            .then((files: File[]) => {
                if (files.length === 0) {
                    return;
                } else if (files.length === 1) {
                    files.forEach((file: File) => {
                        switch (file.type) {
                            case FileType.Any:
                            case FileType.Text:
                                this.ilc()
                                    .services.system.opener.file(file)
                                    .text()
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to open text file; error: ${err.message}`,
                                        );
                                    });
                                break;
                            case FileType.Dlt:
                                this.ilc()
                                    .services.system.opener.file(file)
                                    .dlt()
                                    .catch((err: Error) => {
                                        this.log().error(
                                            `Fail to open dlt file; error: ${err.message}`,
                                        );
                                    });
                                break;
                        }
                    });
                } else {
                    this.ilc()
                        .services.system.session.add()
                        .tab({
                            name: 'Multiple Files',
                            active: true,
                            closable: true,
                            content: {
                                factory: TabSourceMultipleFiles,
                                inputs: { files: files },
                            },
                        });
                }
            })
            .catch((err: Error) => {
                this.log().error(`Fail to open file: ${err.message}`);
            });
    }
}
export interface LayoutWorkspaceNoContent extends IlcInterface {}
