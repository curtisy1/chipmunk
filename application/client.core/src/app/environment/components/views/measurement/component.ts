import { Component, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterContentInit, AfterViewInit, ViewContainerRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ControllerSessionTab } from '../../../controller/controller.session.tab';
import { ControllerSessionTabTimestamp, IRange, EChartMode } from '../../../controller/controller.session.tab.timestamp';
import { IMenuItem } from '../../../services/standalone/service.contextmenu';
import { scheme_color_2, getContrastColor } from '../../../theme/colors';
import { Chart } from 'chart.js';
import { DataService } from './service.data';

import TabsSessionsService from '../../../services/service.sessions.tabs';
import EventsSessionService from '../../../services/standalone/service.events.session';
import ViewsEventsService from '../../../services/standalone/service.views.events';
import ContextMenuService from '../../../services/standalone/service.contextmenu';
import OutputRedirectionsService from '../../../services/standalone/service.output.redirections';

import * as Toolkit from 'chipmunk.client.toolkit';

@Component({
    selector: 'app-views-measurement',
    templateUrl: './template.html',
    styleUrls: ['./styles.less']
})

export class ViewMeasurementComponent implements OnDestroy, AfterContentInit, AfterViewInit {

    @ViewChild('canvas', { static: true }) _ng_canvas: ElementRef<HTMLCanvasElement>;

    public _ng_width: number = 0;

    private _height: number = 0;
    private _subscriptions: { [key: string]: Subscription } = {};
    private _logger: Toolkit.Logger = new Toolkit.Logger('ViewMeasurementComponent');
    private _session: ControllerSessionTab | undefined;
    private _destroy: boolean = false;
    private _chart: Chart | undefined;
    private _service: DataService | undefined;

    constructor(private _cdRef: ChangeDetectorRef,
                private _vcRef: ViewContainerRef) {
    }

    public ngOnDestroy() {
        this._destroy = true;
        Object.keys(this._subscriptions).forEach((key: string) => {
            this._subscriptions[key].unsubscribe();
        });
        if (this._chart !== undefined) {
            this._chart.destroy();
            this._chart = undefined;
        }
        if (this._service !== undefined) {
            this._service.destroy();
            this._service = undefined;
        }
    }

    public ngAfterContentInit() {
    }

    public ngAfterViewInit() {
        this._service = new DataService();
        this._subscriptions.onSessionChange = EventsSessionService.getObservable().onSessionChange.subscribe(
            this._onSessionChange.bind(this),
        );
        this._subscriptions.onSessionChange = this._service.getObservable().update.subscribe(
            this._onChartDataUpdate.bind(this),
        );
        this._subscriptions.onSessionChange = this._service.getObservable().change.subscribe(
            this._onChartDataChange.bind(this),
        );
        this._subscriptions.onResize = ViewsEventsService.getObservable().onResize.subscribe(
            this._onResize.bind(this),
        );
        this._build();
        this._onResize();
        this._onSessionChange(TabsSessionsService.getActive());
    }

    public _ng_onChartContexMenu(event: MouseEvent) {
        if (this._session === undefined) {
            event.stopImmediatePropagation();
            event.preventDefault();
            return;
        }
        const items: IMenuItem[] = [
            {
                caption: `Switch to: ${this._service.getMode() === EChartMode.aligned ? 'scaled' : 'aligned'}`,
                handler: () => {
                    this._service.toggleMode();
                },
            },
            { /* Delimiter */},
            {
                caption: `Remove All Ranges`,
                handler: () => {
                    if (this._session === undefined) {
                        return;
                    }
                    this._session.getTimestamp().drop();
                },
                disabled: this._session.getTimestamp().getCount() === 0,
            },
        ];
        ContextMenuService.show({
            items: items,
            x: event.pageX,
            y: event.pageY,
        });
        event.stopImmediatePropagation();
        event.preventDefault();
    }

    public _ng_getController(): ControllerSessionTabTimestamp | undefined {
        if (this._session === undefined) {
            return undefined;
        }
        return this._session.getTimestamp();
    }

    private _build() {
        if (this._ng_canvas === undefined || this._service === undefined) {
            return;
        }
        switch (this._service.getMode()) {
            case EChartMode.aligned:
                this._buildAlignChart();
                break;
            case EChartMode.scaled:
                this._buildScaleChart();
                break;
        }
    }

    private _buildAlignChart() {
        const data = this._service.getChartDataset();
        if (this._chart === undefined) {
            this._chart = new Chart(this._ng_canvas.nativeElement, {
                type: 'horizontalBar',
                data: {
                    datasets: data.datasets,
                    labels: data.labels,
                },
                options: {
                    onClick: this._onAlignChartClick.bind(this),
                    tooltips: {
                        enabled: false,
                    },
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    hover: {
                        animationDuration: 0
                    },
                    responsiveAnimationDuration: 0,
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [{
                            gridLines: {
                                offsetGridLines: true
                            },
                            stacked: true
                        }],
                        yAxes: [{
                            stacked: true
                        }],
                    },
                    animation: {
                        duration: 1,
                        onComplete: function() {
                            const chartInstance = this.chart;
                            const ctx = chartInstance.ctx;
                            ctx.font = Chart.helpers.fontString(Chart.defaults.global.defaultFontSize, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                            ctx.textAlign = 'right';
                            ctx.textBaseline = 'middle';
                            this.data.datasets.forEach(function(dataset, i) {
                                const meta = chartInstance.controller.getDatasetMeta(i);
                                meta.data.forEach(function(bar, index) {
                                    if (dataset.data[index] === 0) {
                                        return;
                                    }
                                    ctx.fillStyle = getContrastColor(dataset.backgroundColor[index], true);
                                    ctx.fillText(`${dataset.data[index]} ms`, bar._model.x - 4, bar._model.y + 1);
                                });
                            });
                        }
                    }
                }
            });
        } else {
            this._chart.data.datasets = data.datasets;
            this._chart.data.labels = data.labels;
            !this._destroy && this._chart.update();
        }
    }

    private _buildScaleChart() {
        const data = this._service.getChartDataset();
        if (this._chart === undefined) {
            const self = this;
            this._chart = new Chart(this._ng_canvas.nativeElement, {
                type: 'scatter',
                data: {
                    datasets: data.datasets,
                },
                options: {
                    onClick: this._onScaleChartClick.bind(this),
                    tooltips: {
                        enabled: false,
                    },
                    title: {
                        display: false,
                    },
                    legend: {
                        display: false,
                    },
                    hover: {
                        animationDuration: 0
                    },
                    responsiveAnimationDuration: 0,
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        xAxes: [{
                            gridLines: {
                                offsetGridLines: true
                            },
                            ticks: {
                                display: false,
                                min: this._service.getMinTimestamp(),
                                max: this._service.getMaxTimestamp()
                            },
                        }],
                        yAxes: [{
                            ticks: {
                                display: false,
                                min: 0,
                                max: data.maxY + 1,
                                beginAtZero: true,
                            },
                        }],
                    },
                    animation: {
                        duration: 1,
                        onComplete: function() {
                            if (self._service === undefined) {
                                return;
                            }
                            const chartInstance = this.chart;
                            const ctx = chartInstance.ctx;
                            ctx.font = Chart.helpers.fontString(self._service.getOptimalFontSize(), Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                            ctx.textAlign = 'right';
                            this.data.datasets.forEach(function(dataset, i) {
                                const meta = chartInstance.controller.getDatasetMeta(i);
                                const duration: number = dataset.data[1].duration;
                                if (dataset.data[1].range === true) {
                                    ctx.font = Chart.helpers.fontString(self._service.getOptimalFontSize(), Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = getContrastColor(dataset.borderColor, true);
                                    ctx.textBaseline = 'middle';
                                } else {
                                    ctx.font = Chart.helpers.fontString(self._service.getOptimalFontSize() * 0.8, Chart.defaults.global.defaultFontStyle, Chart.defaults.global.defaultFontFamily);
                                    ctx.fillStyle = scheme_color_2;
                                    ctx.textBaseline = 'top';
                                }
                                ctx.fillText(`${duration} ms`, meta.data[1]._model.x - 4, meta.data[1]._model.y + 1);
                            });
                        }
                    }
                }
            });
        } else {
            this._chart.data.datasets = data.datasets;
            this._chart.options.scales.xAxes[0].ticks.min = this._service.getMinTimestamp();
            this._chart.options.scales.xAxes[0].ticks.max = this._service.getMaxTimestamp();
            this._chart.options.scales.yAxes[0].ticks.max = data.maxY + 1;
            !this._destroy && this._chart.update();
        }
    }

    private _onAlignChartClick(event?: MouseEvent, elements?: any[]) {
        if (this._session === undefined || this._service === undefined) {
            return;
        }
        if (!(elements instanceof Array)) {
            return;
        }
        if (elements.length === 0) {
            return;
        }
        if (typeof elements[0]._index !== 'number') {
            return;
        }
        const position: number = this._service.getRefs()[elements[0]._index];
        if (isNaN(position) || !isFinite(position)) {
            return;
        }
        OutputRedirectionsService.select('measurement', this._session.getGuid(), position);
    }

    private _onScaleChartClick(event?: MouseEvent, elements?: any[]) {
        if (this._session === undefined || this._service === undefined) {
            return;
        }
        const el = this._chart.getElementsAtEvent(event);
        // console.log(el);
    }

    private _onSessionChange(controller?: ControllerSessionTab) {
        if (controller === undefined) {
            return;
        }
        this._session = controller;
    }

    private _onChartDataUpdate() {
        this._build();
    }

    private _onChartDataChange() {
        if (this._chart !== undefined) {
            this._chart.destroy();
            this._chart = undefined;
        }
        this._build();
    }

    private _onResize() {
        const size = (this._vcRef.element.nativeElement as HTMLElement).getBoundingClientRect();
        this._ng_width = size.width;
        this._height = size.height;
        if (this._service !== undefined && this._chart !== undefined && !this._destroy) {
            this._service.setHeight(this._height);
            this._service.updateViewRelatedProps(this._chart);
            this._chart.update();
        }
    }

    private _forceUpdate() {
        if (this._destroy) {
            return;
        }
        this._cdRef.detectChanges();
    }

}
