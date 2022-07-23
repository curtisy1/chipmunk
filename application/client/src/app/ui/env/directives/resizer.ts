import {
    AfterViewInit,
    Directive,
    ElementRef,
    OnDestroy,
    HostListener,
    Input,
    Output,
    EventEmitter,
} from '@angular/core';

export enum Direction {
    Vertical = 'Vertical',
    Horizontal = 'Horizontal',
}

@Directive({
    selector: '[appResizer]',
})
export class ResizerDirective implements AfterViewInit, OnDestroy {
    @Input() public direction!: Direction;
    @Input() public min: number = -1;
    @Input() public max: number = -1;
    @Input() public size!: number;
    @Input() public corrector: number = 1;
    @Output() changesize = new EventEmitter<number>();

    private _position: number = -1;

    constructor(private _hostElement: ElementRef) {
        this._mousemove = this._mousemove.bind(this);
        this._mouseup = this._mouseup.bind(this);
        window.addEventListener('mousemove', this._mousemove);
        window.addEventListener('mouseup', this._mouseup);
    }

    @HostListener('mousedown', ['$event']) _mousedown(event: MouseEvent) {
        this._position = this._getPos(event);
    }

    public ngAfterViewInit() {
        (this._hostElement.nativeElement as HTMLElement).focus();
    }

    public ngOnDestroy(): void {
        window.removeEventListener('mousemove', this._mousemove);
        window.removeEventListener('mouseup', this._mouseup);
    }

    private _mousemove(event: MouseEvent) {
        if (this._position === -1) {
            return;
        }
        const diff = this._getPos(event) - this._position;
        this.size -= diff * this.corrector;
        if (this.size > this.max && this.max !== -1) {
            this.size = this.max;
        } else if (this.size < this.min && this.min !== -1) {
            this.size = this.min;
        }
        this._position = this._getPos(event);
        event.stopImmediatePropagation();
        event.preventDefault();
        this.changesize.emit(this.size);
    }

    private _mouseup(event: MouseEvent) {
        this._mousemove(event);
        this._position = -1;
    }

    private _getPos(event: MouseEvent): number {
        return this.direction === Direction.Horizontal ? event.x : event.y;
    }
}