import { Session } from '@service/session';
import { Service } from '@elements/scrollarea/controllers/service';
import { Range } from '@platform/types/range';
import { Row, Owner } from '@schema/content/row';

const SCROLLAREA_SERVICE = 'search_scroll_area_service';

export function getScrollAreaService(session: Session): Service {
    const restored = session.storage.get<Service>(SCROLLAREA_SERVICE);
    if (restored === undefined) {
        const map = session.search.map;
        const service = new Service({
            setFrame: (range: Range) => {
                session.stream
                    .grab(map.getRanges(range.get()))
                    .then((elements) => {
                        service.setRows({
                            rows: elements.map((el) => {
                                return new Row({
                                    position: el.position,
                                    content: el.content,
                                    session: session,
                                    owner: Owner.Search,
                                    source:
                                        typeof el.source_id === 'string'
                                            ? parseInt(el.source_id, 10)
                                            : el.source_id,
                                });
                            }),
                            range,
                        });
                        service.setLen(map.len());
                    })
                    .catch((err: Error) => {
                        throw new Error(`Fail get chunk: ${err.message}`);
                    });
            },
            getLen: (): number => {
                return map.len();
            },
            getItemHeight: (): number => {
                return 16;
            },
        });
        service.setLen(map.len());
        return service;
    } else {
        restored.setLen(session.search.map.len());
        return restored;
    }
}

export function setScrollAreaService(session: Session, service: Service) {
    session.storage.set(SCROLLAREA_SERVICE, service);
}
