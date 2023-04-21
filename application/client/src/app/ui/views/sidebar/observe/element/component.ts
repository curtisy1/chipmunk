import { Component, Input, HostListener } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Element } from './element';

@Component({
    selector: 'app-views-observed-list-item',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Item {
    @Input() element!: Element;

    @HostListener('contextmenu', ['$event']) async onContextMenu(event: MouseEvent) {
        const items = this.element.provider.contextMenu(this.element.source);
        if (items.length > 0) {
            items.push({});
        }
        items.push({
            caption: 'Reopen in New Tab',
            handler: () => {
                this.element.provider.openAsNew(this.element.source).catch((err: Error) => {
                    this.log().error(`Fail to open Source: ${err.message}`);
                });
            },
        });
        this.ilc().emitter.ui.contextmenu.open({
            items,
            x: event.x,
            y: event.y,
        });
    }
}
export interface Item extends IlcInterface {}