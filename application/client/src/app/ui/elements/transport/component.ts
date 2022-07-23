import { Component, ChangeDetectorRef, Input } from '@angular/core';
import { Ilc, IlcInterface } from '@env/decorators/component';
import { ChangesDetector } from '@ui/env/extentions/changes';
import { State } from './state';
import { Source } from '@platform/types/transport';

@Component({
    selector: 'app-transport',
    templateUrl: './template.html',
    styleUrls: ['./styles.less'],
})
@Ilc()
export class Transport extends ChangesDetector {
    public readonly Source = Source;

    @Input() public state!: State;

    public sources: { ref: Source; name: string }[] = [
        { ref: Source.Udp, name: 'UDP Connection' },
        { ref: Source.Tcp, name: 'TCP Connection' },
        { ref: Source.Serial, name: 'Serial Port' },
    ];

    constructor(cdRef: ChangeDetectorRef) {
        super(cdRef);
    }

    public ngOnSourceChange() {
        this.state.switch();
    }
}
export interface Transport extends IlcInterface {}