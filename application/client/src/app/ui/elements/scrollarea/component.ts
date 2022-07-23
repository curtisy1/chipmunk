import {
    Component,
    OnDestroy,
    ChangeDetectorRef,
    ViewChild,
    Input,
    AfterViewInit,
    ElementRef,
    ChangeDetectionStrategy,
    HostBinding,
    HostListener,
} from '@angular/core';
import { Subscriber } from '@platform/env/subscription';
import { Row } from '@schema/content/row';
import { Holder } from './controllers/holder';
import { Service } from './controllers/service';
import { Frame, ChangesInitiator } from './controllers/frame';
import { Selecting, SelectionDirection } from './controllers/selection';
import { Keyboard } from './controllers/keyboard';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { RemoveHandler } from '@ui/service/styles';
import { Ilc, IlcInterface } from '@env/decorators/component';

export interface IScrollBoxSelection {
    selection: string;
    original: string;
    anchor: number;
    anchorOffset: number;
    focus: number;
    focusOffset: number;
}

@Component({
    selector: 'app-scrollarea',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
@Ilc()
export class ScrollAreaComponent extends ChangesDetector implements OnDestroy, AfterViewInit {
    @ViewChild('content_holder', { static: false }) _nodeHolder!: ElementRef<HTMLElement>;

    @Input() public service!: Service;

    private readonly _subscriber: Subscriber = new Subscriber();
    private _cssClass: string = '';
    private _removeGlobalStyleHandler: RemoveHandler | undefined;

    @HostBinding('tabindex') get tabindex() {
        return 0;
    }

    @HostBinding('class') set cssClass(cssClass: string) {
        this._cssClass = cssClass;
    }
    get cssClass() {
        return this._cssClass;
    }

    @HostListener('window:keydown', ['$event']) onKeyDown(event: KeyboardEvent) {
        this.keyboard.process(event);
    }

    @HostListener('window:keyup') onKeyUp() {
        this.keyboard.stop();
    }

    @HostListener('focus') onFocus() {
        this.keyboard.focus();
        this.service.focus().in();
    }

    @HostListener('blur') onBlur() {
        this.keyboard.blur();
        this.service.focus().out();
    }

    public rows: Row[] = [];
    public readonly holder: Holder = new Holder();
    public readonly frame: Frame = new Frame();
    public readonly selecting: Selecting = new Selecting();
    public readonly keyboard: Keyboard = new Keyboard();
    public selectionDirection = SelectionDirection;

    constructor(changeDetectorRef: ChangeDetectorRef) {
        super(changeDetectorRef);
    }

    public ngOnDestroy(): void {
        this.detauchChangesDetector();
        this.holder.destroy();
        this.frame.destroy();
        this.selecting.destroy();
        this._subscriber.unsubscribe();
    }

    public ngAfterViewInit(): void {
        this.holder.bind(this._nodeHolder);
        this.frame.bind(this.service, this.holder);
        this.service.bind(this.frame);
        this.selecting.bind(this._nodeHolder.nativeElement, this.frame);
        this.keyboard.bind(this.frame);
        this._subscriber.register(
            this.frame.onFrameChange((rows: Row[]) => {
                const exists = this.rows.length;
                rows.forEach((updated: Row, i: number) => {
                    if (i < exists) {
                        this.rows[i].from(updated);
                    } else {
                        this.rows.push(updated);
                    }
                });
                if (rows.length < exists) {
                    this.rows.splice(rows.length).forEach((row) => {
                        row.destroy();
                    });
                }
                this.detectChanges();
                this.selecting.restore();
            }),
        );
        this._subscriber.register(
            this.selecting.onSelectionStart(() => {
                this.cssClass = 'selecting';
                this._removeGlobalStyleHandler = this.ilc().services.ui.styles
                    .add(`:not(.selecting *) {
					user-select: none;
				}`);
            }),
        );
        this._subscriber.register(
            this.selecting.onSelectionFinish(() => {
                this.cssClass = '';
                if (typeof this._removeGlobalStyleHandler === 'function') {
                    this._removeGlobalStyleHandler();
                    this._removeGlobalStyleHandler = undefined;
                }
            }),
        );
        this._subscriber.register(
            this.ilc().services.system.hotkeys.listen('g', () => {
                if (!this.service.focus().get()) {
                    return;
                }
                this.service.scrollToTop();
            }),
        );
        this._subscriber.register(
            this.ilc().services.system.hotkeys.listen('gg', () => {
                if (!this.service.focus().get()) {
                    return;
                }
                this.service.scrollToBottom();
            }),
        );

        this.frame.init();
    }

    public getFrameStart(): number {
        return this.frame.get().from;
    }

    public onScrolling(position: number) {
        this.frame.moveTo(position, ChangesInitiator.Scrolling);
    }

    public onWheel(event: WheelEvent) {
        if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
            this.frame.offsetTo(event.deltaY, ChangesInitiator.Wheel);
            event.preventDefault();
        }
    }

    public showSelectionDetectors(): boolean {
        return this._removeGlobalStyleHandler !== undefined;
    }

    public onMouseMoveSelectionDetector(direction: SelectionDirection) {
        this.selecting.doSelectionInDirection(direction);
    }
}
export interface ScrollAreaComponent extends IlcInterface {}