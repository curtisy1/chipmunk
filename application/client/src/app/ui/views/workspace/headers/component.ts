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
import { LimittedValue } from '@ui/env/entities/value.limited';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { Direction } from '@directives/resizer';

class RenderedHeader {
    public caption: string;
    public styles: { [key: string]: string } = {};
    public width: LimittedValue | undefined;

    private _ref: Header;

    constructor(ref: Header) {
        this._ref = ref;
        this.caption = ref.caption;
        this.width = ref.width;
        this.width !== undefined && this.resize(this.width.value);
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

    @Input() public controller!: Columns;
    @Input() public session!: Session;

    public headers: RenderedHeader[] = [];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngAfterContentInit(): void {
        this.ilc().channel.ui.row.rank(() => {
            this.markChangesForCheck();
        });
        this.headers = this.controller.headers
            .filter((h) => h.visible)
            .map((h) => new RenderedHeader(h));
        this.markChangesForCheck();
    }

    public ngGetOffsetStyle(): { [key: string]: string } {
        return {
            width: `${this.session.stream.rank.width()}px`,
            minWidth: `${this.session.stream.rank.width()}px`,
        };
    }

    public ngResize(width: number, header: RenderedHeader) {
        header.resize(width);
        this.markChangesForCheck();
        setTimeout(() => {
            this.controller.update.emit();
        });
    }
}
export interface ColumnsHeaders extends IlcInterface {}
