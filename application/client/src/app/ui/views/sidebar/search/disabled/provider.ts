import { Entity } from '../providers/definitions/entity';
import { Provider } from '../providers/definitions/provider';
import { DisabledRequest } from '@service/session/dependencies/search/disabled/store';
import { IComponentDesc } from '@ui/elements/containers/dynamic/component';
import { Session } from '@service/session/session';
import { Subscription } from 'rxjs';
import { DisabledList } from './list/component';
import { IMenuItem } from '@ui/service/contextmenu';
import { DisableConvertable } from '@service/session/dependencies/search/disabled/converting';
import { FilterRequest } from '@service/session/dependencies/search/filters/request';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DragableRequest, ListContent } from '../draganddrop/service';
import { EntityData } from '../providers/definitions/entity.data';
import { Subscriber } from '@platform/env/subscription';

export class ProviderDisabled extends Provider<DisabledRequest> {
    private _subs: { [key: string]: Subscription } = {};
    private _entities: Map<string, Entity<DisabledRequest>> = new Map();
    private _listID: ListContent = ListContent.disabledList;

    public init(): void {
        this.subscriber.register(
            this.session.search
                .store()
                .disabled()
                .subjects.update.subscribe((_items) => {
                    super.change();
                    this.select().drop();
                }),
        );
    }

    public get(): Array<Entity<DisabledRequest>> {
        const guids: string[] = [];
        const entities = this.session.search
            .store()
            .disabled()
            .get()
            .map((item: DisabledRequest) => {
                let entity = this._entities.get(item.uuid());
                if (entity === undefined) {
                    entity = new Entity<DisabledRequest>(item);
                } else {
                    entity.set(item);
                }
                this._entities.set(item.uuid(), entity);
                guids.push(item.uuid());
                return entity;
            });
        this._entities.forEach((_, guid: string) => {
            if (guids.indexOf(guid) === -1) {
                this._entities.delete(guid);
            }
        });
        return entities;
    }

    public reorder(params: { prev: number; curt: number }) {
        this.session.search.store().disabled().reorder(params);
        super.change();
    }

    public getContentIfEmpty(): undefined {
        return undefined;
    }

    public getPanelName(): string {
        return `Disabled`;
    }

    public getPanelDesc(): string {
        const count = this.get().length;
        return `${count} ${count > 1 ? 'entities' : 'entity'}`;
    }

    public getDetailsPanelName(): string | undefined {
        return undefined;
    }

    public getDetailsPanelDesc(): string | undefined {
        return undefined;
    }

    public getListComp(): IComponentDesc {
        return {
            factory: DisabledList,
            inputs: {
                provider: this,
                draganddrop: this.draganddrop,
            },
        };
    }

    public getDetailsComp(): IComponentDesc | undefined {
        return undefined;
    }

    public getContextMenuItems(target: Entity<any>, selected: Array<Entity<any>>): IMenuItem[] {
        const entities: DisableConvertable[] = selected
            .filter((entity: Entity<any>) => {
                return !(entity.extract() instanceof DisabledRequest);
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.extract() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        // const match = disableds.find((entity) => {
        //     return entity.entity().matches !== undefined;
        // });
        const items: IMenuItem[] = [];
        // if (entities.length > 0 && disableds.length === 0) {
        //     items.push({
        //         caption: `Disable`,
        //         handler: () => {
        //             this.session.search
        //                 .store()
        //                 .disabled()
        //                 .add(
        //                     entities.map((entity: DisableConvertable) => {
        //                         entity.remove(session);
        //                         return new DisabledRequest(entity);
        //                     }),
        //                 );
        //         },
        //     });
        // }
        // if (entities.length === 0 && disableds.length > 0) {
        //     items.push({
        //         caption: `Enable`,
        //         handler: () => {
        //             disableds.forEach((disabled: DisabledRequest) => {
        //                 disabled.entity().restore(session);
        //                 this.session.search.store().disabled().delete([disabled.uuid()]);
        //             });
        //         },
        //     });
        // }
        // if (match !== undefined) {
        //     const entry = match.entity();
        //     items.push({
        //         caption: `Show Matches`,
        //         handler: () => {
        //             entry.matches !== undefined && entry.matches(session);
        //         },
        //     });
        // }
        return items;
    }

    public search(entity: Entity<any>) {
        // const cEntity = entity.extract().getEntity();
        // if (cEntity instanceof ChartRequest) {
        //     this.session.search.search(
        //         new FilterRequest({
        //             request: (cEntity as ChartRequest).asDesc().request,
        //             flags: {
        //                 casesensitive: false,
        //                 wholeword: false,
        //                 regexp: true,
        //             },
        //         }),
        //     );
        // } else if (cEntity instanceof FilterRequest) {
        //     session.getSessionSearch().search(cEntity);
        // }
        // if (cEntity instanceof FilterRequest) {
        //     this.session.search.search([cEntity.definition.filter]).catch((err: Error) => {
        //         this.logger.error(
        //             `Fail to make search for "${cEntity.definition.filter.filter}": ${err.message}`,
        //         );
        //     });
        // }
    }

    public actions(
        target: Entity<any>,
        selected: Array<Entity<any>>,
    ): {
        activate?: () => void;
        deactivate?: () => void;
        remove?: () => void;
        edit?: () => void;
    } {
        const disableds: DisabledRequest[] = selected
            .filter((entity: Entity<any>) => {
                return entity.extract() instanceof DisabledRequest;
            })
            .map((entity: Entity<any>) => {
                return entity.extract();
            });
        return {
            remove:
                disableds.length !== 0
                    ? () => {
                          disableds.forEach((disabled: DisabledRequest) => {
                              this.session.search.store().disabled().delete([disabled.uuid()]);
                          });
                      }
                    : undefined,
        };
    }

    // Method because of abstract class, not used
    public isViable() {
        return true;
    }

    public itemDragged(event: CdkDragDrop<EntityData<DragableRequest>>) {
        if (event.previousContainer === event.container) {
            this.reorder({ prev: event.previousIndex, curt: event.currentIndex });
        } else {
            const index: number = event.previousIndex;
            const data: EntityData<DragableRequest> = event.previousContainer.data;
            if (data.entries !== undefined) {
                // const outside: Entity<DragableRequest> | undefined =
                //     data.entries[event.previousIndex] !== undefined
                //         ? data.entries[index]
                //         : undefined;
                // if (outside !== undefined) {
                //     this.session.search
                //         .store()
                //         .disabled()
                //         .add(
                //             new DisabledRequest(
                //                 outside.getEntity() as unknown as DisableConvertable,
                //             ),
                //             event.currentIndex,
                //         );
                //     outside.extract().remove(session);
                // }
            }
        }
    }

    public get listID(): ListContent {
        return this._listID;
    }
}
