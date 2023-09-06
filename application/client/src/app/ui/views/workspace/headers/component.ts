import {
    Component,
    Input,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    AfterContentInit,
} from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { Columns, Header } from '@schema/render/columns';
import { Session } from '@service/session';
import { contextmenu } from '@ui/service/contextmenu';
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';
import { ViewWorkspaceHeadersMenuComponent } from './menu/component';
import { v4 as uuidv4 } from 'uuid';

class RenderedHeader {
    public caption: string;
    public styles: { [key: string]: string } = {};
    public width: LimittedValue | undefined;
    public color: string | undefined;
    public uuid: string;

    private _ref: Header;

    constructor(ref: Header) {
        this._ref = ref;
        this.caption = ref.caption;
        this.width = ref.width;
        this.color = ref.color;
        this.width !== undefined && this.resize(this.width.value);
        this.uuid = ref.uuid;
    }

    public resize(width: number) {
        if (this._ref.width === undefined || this.width === undefined) {
            return;
        }
        this._ref.width.set(width);
        this.styles = {
            width: `${this.width.value}px`,
            minWidth: `${this.width.value}px`,
        };
    }
}

@Component({
    selector: 'app-scrollarea-row-columns-headers',
    styleUrls: ['./styles.less'],
    templateUrl: './template.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class ColumnsHeaders extends ChangesDetector implements AfterContentInit {
    public readonly Direction = Direction;
    public offset: number = 0;
    public ngMore: string = 'more_horiz';

    @Input() public controller!: Columns;
    @Input() public session!: Session;

    public headers: RenderedHeader[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.env().subscriber.register(
            this.session.stream.subjects.get().rank.subscribe(() => {
                this.markChangesForCheck();
            }),
            this.controller.subjects.get().visibility.subscribe(() => {
                this.headers = this.controller.headers
                .filter((h) => h.visible)
                .map((h) => new RenderedHeader(h));
                this.markChangesForCheck();
            })
        );
        this.headers = this.controller.headers
            .filter((h) => h.visible)
            .map((h) => new RenderedHeader(h));
        this.markChangesForCheck();
    }

    public ngOnClick(event: MouseEvent, column: number): void {
        contextmenu.show({
            component: {
                factory: ViewWorkspaceHeadersMenuComponent,
                inputs: {
                    column,
                    controller: this.controller,
                },
            },
            x: event.pageX,
            y: event.pageY,
        });
    }

    public ngGetOffsetStyle(): { [key: string]: string } {
        return {
            width: `${this.session.stream.rank.width()}px`,
            minWidth: `${this.session.stream.rank.width()}px`,
            marginLeft: `-${this.offset}px`,
        };
    }

    public ngResize(width: number, header: RenderedHeader) {
        header.resize(width);
        const headerIndex = this.controller.headers.findIndex(h => h.uuid === header.uuid);
        debugger
        this.markChangesForCheck();
        this.controller.subjects.get().resized.emit(headerIndex);
    }

    public setOffset(left: number): void {
        this.offset = left;
        this.markChangesForCheck();
    }
}
export interface ColumnsHeaders extends IlcInterface {}
