import shared from '../_shared/shared.module.js?492056';
import { Column, ColumnStore, Combo, Toolbar, DateHelper, CSSHelper, TaskModel, Gantt, ResourceGrid, ProjectModel } from '../../build/gantt.module.js?492056';
//region "lib/ComplexityColumn.js"

/**
 * @module ComplexityColumn
 */

/**
 * A custom column showing the complexity of a task
 *
 * @extends Gantt/column/Column
 * @classtype complexitycolumn
 */
class ComplexityColumn extends Column {
    static $name         = 'ComplexityColumn';
    static type          = 'complexitycolumn';
    static isGanttColumn = true;
    static defaults      = {
        // Set your default instance config properties here
        field   : 'complexity',
        text    : 'Complexity',
        cellCls : 'b-complexity-column-cell',
        editor  : { type : 'complexitycombo' }
    };

    //endregion

    renderer({ column, value }) {
        const
            { store } = column.editor,
            complexity = store.getById(value)?.text;

        return complexity ? [{
            tag       : 'i',
            className : `fa fa-square ${complexity}`
        }, complexity] : '';
    }
}

ColumnStore.registerColumnType(ComplexityColumn);

//endregion

//region "lib/ComplexityCombo.js"

class ComplexityCombo extends Combo {
    static type          = 'complexitycombo';
    static configurable = {
        items : [
            { value : 0, text : 'Easy' },
            { value : 1, text : 'Normal' },
            { value : 2, text : 'Hard' },
            { value : 3, text : 'Impossible' }
        ],
        picker : {
            minWidth : '8em'
        },
        listItemTpl : ({ text }) => `
            <div>
                <i style="margin-inline-end: 0.5em" class="fa fa-square ${text}"></i>
                <small>${text}</small>
            </div>
        `
    };

    syncInputFieldValue(...args) {
        const complexity = this.store.getById(this.value)?.text;
        this.icon.className = `fa fa-square ${complexity}`;
        super.syncInputFieldValue(...args);
    }

    get innerElements() {
        return [
            {
                reference : 'icon',
                tag       : 'i',
                style     : {
                    marginInlineStart : '.8em',
                    marginInlineEnd   : '-.3em'
                }
            },
            ...super.innerElements
        ];
    }
}

// Register class to be able to create widget by type
ComplexityCombo.initClass();

//endregion

//region "lib/GanttToolbar.js"

/**
 * @module GanttToolbar
 */

/**
 * @extends Core/widget/Toolbar
 */
class GanttToolbar extends Toolbar {
    // Factoryable type name
    static type = 'gantttoolbar';

    static $name = 'GanttToolbar';

    static configurable = {
        items : {
            views : {
                type        : 'buttongroup',
                toggleGroup : true,
                rendition   : 'padded',
                items       : {
                    ganttButton : {
                        icon       : 'fa fa-chart-gantt',
                        text       : 'Gantt',
                        tooltip    : 'Gantt view',
                        pressed    : true,
                        toggleable : true
                    },
                    resourceViewButton : {
                        icon     : 'fa fa-users',
                        text     : 'Resources',
                        tooltip  : 'Resource grid',
                        onAction : 'up.onResourceViewButtonClick'
                    }
                }
            },
            addTaskButton : {
                color    : 'b-green',
                icon     : 'fa fa-plus',
                text     : 'Create',
                tooltip  : 'Create new task',
                onAction : 'up.onAddTaskClick'
            },
            undoRedo : {
                type  : 'undoredo',
                items : {
                    transactionsCombo : null
                }
            },
            toggleButtons : {
                type  : 'buttonGroup',
                items : {
                    expandAllButton : {
                        icon     : 'fa fa-angle-double-down',
                        tooltip  : 'Expand all',
                        onAction : 'up.onExpandAllClick'
                    },
                    collapseAllButton : {
                        icon     : 'fa fa-angle-double-up',
                        tooltip  : 'Collapse all',
                        onAction : 'up.onCollapseAllClick'
                    }
                }
            },
            zoomButtons : {
                type  : 'buttonGroup',
                items : {
                    zoomInButton : {
                        icon     : 'fa fa-search-plus',
                        tooltip  : 'Zoom in',
                        onAction : 'up.onZoomInClick'
                    },
                    zoomOutButton : {
                        icon     : 'fa fa-search-minus',
                        tooltip  : 'Zoom out',
                        onAction : 'up.onZoomOutClick'
                    },
                    zoomToFitButton : {
                        icon     : 'fa fa-compress-arrows-alt',
                        tooltip  : 'Zoom to fit',
                        onAction : 'up.onZoomToFitClick'
                    },
                    previousButton : {
                        icon     : 'fa fa-angle-left',
                        tooltip  : 'Previous time span',
                        onAction : 'up.onShiftPreviousClick'
                    },
                    nextButton : {
                        icon     : 'fa fa-angle-right',
                        tooltip  : 'Next time span',
                        onAction : 'up.onShiftNextClick'
                    }
                }
            },
            projectSelector : {
                type         : 'combo',
                label        : 'Choose project',
                editable     : false,
                inputWidth   : '14em',
                displayField : 'name',
                value        : 1,
                store        : {
                    data : [
                        {
                            id   : 1,
                            name : 'Launch SaaS',
                            url  : '../_datasets/launch-saas-advanced.json'
                        },
                        {
                            id   : 2,
                            name : 'Build cool app',
                            url  : '../_datasets/tasks-workedhours.json'
                        }
                    ]
                },
                listeners : {
                    select : 'up.onProjectSelected'
                },
                triggers : {
                    editProject : {
                        tooltip : 'Edit project',
                        cls     : 'fa fa-edit',
                        handler : 'up.onProjectEditorButtonClick'
                    }
                }
            },
            spacer       : {  type : 'widget', cls : 'b-toolbar-fill' },
            filterByName : {
                type                 : 'textfield',
                cls                  : 'filter-by-name',
                flex                 : '0 0 14em',
                placeholder          : 'Find tasks by name',
                clearable            : true,
                keyStrokeChangeDelay : 100,
                triggers             : {
                    filter : {
                        align : 'end',
                        cls   : 'fa fa-filter'
                    }
                },
                onChange : 'up.onFilterChange'
            },
            featuresButton : {
                type    : 'button',
                icon    : 'fa fa-tasks',
                text    : 'Settings',
                tooltip : 'Toggle features',
                menu    : {
                    onItem       : 'up.onFeaturesClick',
                    onBeforeShow : 'up.onFeaturesShow',
                    // "checked" is set to a boolean value to display a checkbox for menu items. No matter if it is true or false.
                    // The real value is set dynamically depending on the "disabled" config of the feature it is bound to.
                    items        : {
                        settings : {
                            text : 'UI settings',
                            icon : 'fa fa-sliders-h',
                            menu : {
                                cls          : 'settings-menu',
                                layout       : 'vbox',
                                onBeforeShow : 'up.onSettingsShow',
                                defaults     : {
                                    type       : 'slider',
                                    showValue  : true,
                                    labelWidth : '10em',
                                    width      : '25em'
                                },
                                // width : '25em',
                                items : {
                                    rowHeight : {
                                        text    : 'Row height',
                                        unit    : 'px',
                                        min     : 30,
                                        max     : 70,
                                        onInput : 'up.onRowHeightChange'
                                    },
                                    barMargin : {
                                        text    : 'Bar margin',
                                        unit    : 'px',
                                        min     : 0,
                                        max     : 10,
                                        onInput : 'up.onBarMarginChange'
                                    },
                                    duration : {
                                        text    : 'Animation duration',
                                        unit    : 'ms',
                                        min     : 0,
                                        max     : 2000,
                                        step    : 100,
                                        onInput : 'up.onAnimationDurationChange'
                                    },
                                    radius : {
                                        text    : 'Dependency radius',
                                        unit    : 'px',
                                        min     : 0,
                                        max     : 10,
                                        onInput : 'up.onDependencyRadiusChange'
                                    }
                                }
                            }
                        },
                        showWbs : {
                            text    : 'Show WBS code',
                            checked : true,
                            onItem  : 'up.onShowWBSToggle'
                        },
                        drawDeps : {
                            text    : 'Draw dependencies',
                            feature : 'dependencies',
                            checked : false
                        },
                        taskLabels : {
                            text    : 'Task labels',
                            feature : 'labels',
                            checked : false
                        },
                        criticalPaths : {
                            text    : 'Critical paths',
                            feature : 'criticalPaths',
                            tooltip : 'Highlight critical paths',
                            checked : false
                        },
                        projectLines : {
                            text    : 'Project lines',
                            feature : 'projectLines',
                            checked : false
                        },
                        nonWorkingTime : {
                            text    : 'Highlight non-working time',
                            feature : 'nonWorkingTime',
                            checked : false
                        },
                        cellEdit : {
                            text    : 'Enable cell editing',
                            feature : 'cellEdit',
                            checked : false
                        },
                        autoEdit : {
                            text    : 'Auto edit',
                            checked : false,
                            onItem  : 'up.onAutoEditToggle'
                        },
                        columnLines : {
                            text    : 'Show column lines',
                            feature : 'columnLines',
                            checked : true
                        },
                        rowLines : {
                            text    : 'Show row lines',
                            onItem  : 'up.onRowLinesToggle',
                            checked : true
                        },
                        baselines : {
                            text    : 'Show baselines',
                            feature : 'baselines',
                            checked : false
                        },
                        rollups : {
                            text    : 'Show rollups',
                            feature : 'rollups',
                            checked : false
                        },
                        progressLine : {
                            text    : 'Show progress line',
                            feature : 'progressLine',
                            checked : false
                        },
                        parentArea : {
                            text    : 'Show parent area',
                            feature : 'parentArea',
                            checked : false
                        },
                        fillTicks : {
                            text         : 'Stretch tasks to fill ticks',
                            toggleConfig : 'fillTicks',
                            checked      : false
                        },
                        hideSchedule : {
                            text    : 'Hide schedule',
                            cls     : 'b-separator',
                            subGrid : 'normal',
                            checked : false
                        }
                    }
                }
            }
        }
    };

    construct(...args) {
        super.construct(...args);

        this.styleNode = document.createElement('style');
        document.head.appendChild(this.styleNode);
    }

    get gantt() {
        return this._gantt || (this._gantt = this.owner);
    }

    setAnimationDuration(value) {
        const
            me      = this,
            cssText = `.b-animating .b-gantt-task-wrap { transition-duration: ${value / 1000}s !important; }`;

        me.gantt.transitionDuration = value;

        if (me.transitionRule) {
            me.transitionRule.cssText = cssText;
        }
        else {
            me.transitionRule = CSSHelper.insertRule(cssText);
        }
    }

    // region controller methods

    onResourceViewButtonClick() {
        this.widgetMap.ganttButton.pressed = true;
        this.gantt.hidden = true;
        this.resourceGrid.hidden = false;
    }

    async onAddTaskClick() {
        const
            { gantt } = this,
            added     = gantt.taskStore.rootNode.appendChild({
                name     : this.L('New task'),
                duration : 1
            });

        // run propagation to calculate new task fields
        await gantt.project.commitAsync();

        // scroll to the added task
        await gantt.scrollRowIntoView(added);

        gantt.features.cellEdit.startEditing({
            record : added,
            field  : 'name'
        });
    }

    onExpandAllClick() {
        this.gantt.expandAll();
    }

    onCollapseAllClick() {
        this.gantt.collapseAll();
    }

    onZoomInClick() {
        this.gantt.zoomIn();
    }

    onZoomOutClick() {
        this.gantt.zoomOut();
    }

    onZoomToFitClick() {
        this.gantt.zoomToFit({
            leftMargin  : 50,
            rightMargin : 50
        });
    }

    onShiftPreviousClick() {
        this.gantt.shiftPrevious();
    }

    onShiftNextClick() {
        this.gantt.shiftNext();
    }

    onAutoEditToggle({ item }) {
        this.gantt.features.cellEdit.autoEdit = item.checked;
    }

    onRowLinesToggle({ item }) {
        this.gantt.rowLines = item.checked;
    }

    async onProjectSelected({ record, userAction }) {
        // react on user actions only
        if (userAction) {
            const { gantt } = this;

            await gantt.project.load(record.url);

            gantt.zoomToFit();
            gantt.visibleDate = {
                date  : DateHelper.add(gantt.project.startDate, -1, 'week'),
                block : 'start'
            };
        }
    }

    onProjectEditorButtonClick() {
        this.gantt.editProject();
    }

    onFilterChange({ value }) {
        if (value === '') {
            this.gantt.taskStore.clearFilters();
        }
        else {
            value = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            this.gantt.taskStore.filter({
                filters : task => task.name && task.name.match(new RegExp(value, 'i')),
                replace : true
            });
        }
    }

    onFeaturesClick({ source : item }) {
        const { gantt } = this;

        if (item.feature) {
            const feature = gantt.features[item.feature];
            feature.disabled = !feature.disabled;
        }
        else if (item.subGrid) {
            const subGrid = gantt.subGrids[item.subGrid];
            subGrid.collapsed = !subGrid.collapsed;
        }
        else if (item.toggleConfig) {
            gantt[item.toggleConfig] = item.checked;
        }
    }

    onFeaturesShow({ source : menu }) {
        const { gantt } = this;

        menu.items.map(item => {
            const { feature } = item;

            if (feature) {
                // a feature might be not presented in the gantt
                // (the code is shared between "advanced" and "php" demos which use a bit different set of features)
                if (gantt.features[feature]) {
                    item.checked = !gantt.features[feature].disabled;
                }
                // hide not existing features
                else {
                    item.hide();
                }
            }
            else if (item.subGrid) {
                item.checked = gantt.subGrids[item.subGrid].collapsed;
            }
        });
    }

    onSettingsShow({ source : menu }) {
        const
            { gantt } = this,
            {
                rowHeight,
                barMargin,
                duration,
                radius
            }         = menu.widgetMap;

        rowHeight.value = gantt.rowHeight;
        barMargin.value = gantt.barMargin;
        barMargin.max = (gantt.rowHeight / 2) - 5;
        duration.value = gantt.transitionDuration;
        radius.value = gantt.features.dependencies.radius ?? 0;
    }

    onRowHeightChange({
        value,
        source
    }) {
        this.gantt.rowHeight = value;
        source.owner.widgetMap.barMargin.max = (value / 2) - 5;
    }

    onBarMarginChange({ value }) {
        this.gantt.barMargin = value;
    }

    onAnimationDurationChange({ value }) {
        this.gantt.transitionDuration = value;
        this.styleNode.innerHTML = `.b-animating .b-gantt-task-wrap { transition-duration: ${value / 1000}s !important; }`;
    }

    onDependencyRadiusChange({ value }) {
        this.gantt.features.dependencies.radius = value;
    }

    onCriticalPathsClick({ source }) {
        this.gantt.features.criticalPaths.disabled = !source.pressed;
    }

    onShowWBSToggle({ item }) {
        this.gantt.columns.get('name').showWbs = item.checked;
    }

    // endregion
}

// Register this widget type with its Factory
GanttToolbar.initClass();

//endregion

//region "lib/StatusColumn.js"

/**
 * @module StatusColumn
 */

/**
 * A column showing the status of a task
 *
 * @extends Gantt/column/Column
 * @classtype statuscolumn
 */
class StatusColumn extends Column {

    static $name = 'StatusColumn';

    static type = 'statuscolumn';

    static get isGanttColumn() {
        return true;
    }

    static get defaults() {
        return {
            // Set your default instance config properties here
            field      : 'status',
            text       : 'Status',
            editor     : false,
            readOnly   : true, // For FillHandle etc.
            cellCls    : 'b-status-column-cell',
            htmlEncode : false,
            width      : 120,
            filterable : {
                filterField : {
                    type  : 'combo',
                    items : ['Not Started', 'Started', 'Completed', 'Late']
                }
            }
        };
    }

    //endregion

    renderer({ record }) {
        const status = record.status;

        return status ? [{
            tag       : 'i',
            className : `fa fa-circle ${status}`
        }, status] : '';
    }

    // * reactiveRenderer() {
    //     const
    //         percentDone = yield this.record.$.percentDone;
    //         //endDate     = yield this.record.$.endDate;
    //
    //     let status;
    //
    //     if (percentDone >= 100) {
    //         status = 'Completed';
    //     }
    //     // else if (endDate < Date.now()) {
    //     //     status = 'Late';
    //     // }
    //     else if (percentDone > 0) {
    //         status = 'Started';
    //     }
    //
    //     return status ? {
    //         tag       : 'i',
    //         className : `fa fa-circle ${status}`,
    //         html      : status
    //     } : '';
    // }
}

ColumnStore.registerColumnType(StatusColumn);

//endregion

//region "lib/Task.js"

// here you can extend our default Task class with your additional fields, methods and logic
class Task extends TaskModel {

    static $name = 'Task';

    static get fields() {
        return [
            // enable project border constraint check
            { name : 'projectConstraintResolution', defaultValue : 'conflict' },
            'status', // For status column
            { name : 'complexity', type : 'number' } // For complexity column
        ];
    }

    get isLate() {
        return !this.isCompleted && this.deadlineDate && Date.now() > this.deadlineDate;
    }

    get status() {
        let status = 'Not started';

        if (this.isCompleted) {
            status = 'Completed';
        }
        else if (this.isLate) {
            status = 'Late';
        }
        else if (this.isStarted) {
            status = 'Started';
        }

        return status;
    }
}

//endregion

//region "lib/ResourceGridToolbar.js"

/**
 * @module ResourceGridToolbar
 */

/**
 * @extends Core/widget/Toolbar
 */
class ResourceGridToolbar extends Toolbar {
    // Factoryable type name
    static type = 'resourcegridtoolbar';

    static $name = 'ResourceGridToolbar';

    static configurable = {
        items : {
            views : {
                type        : 'buttongroup',
                toggleGroup : true,
                rendition   : 'padded',
                items       : {
                    viewButton : {
                        icon     : 'fa fa-chart-gantt',
                        text     : 'Gantt',
                        tooltip  : 'Gantt view',
                        onAction : 'up.onGanttButtonClick'
                    },
                    resourceViewButton : {
                        icon    : 'fa fa-users',
                        text    : 'Resources',
                        tooltip : 'Resource grid',
                        pressed : true
                    }
                }
            },

            addResourceButton : {
                color    : 'b-green',
                icon     : 'fa fa-plus',
                text     : 'Create',
                tooltip  : 'Create new resource',
                onAction : 'up.onAddResourceClick'
            },
            undoRedo : {
                type  : 'undoredo',
                items : {
                    transactionsCombo : null
                }
            },
            label : {
                type : 'label',
                text : 'Display resource types'
            },
            filterByTypeButtons : {
                type       : 'buttonGroup',
                onChange   : 'up.onFilterByTypeChange',
                toggleable : true,
                rendition  : 'padded',
                items      : {
                    workResources : {
                        icon    : 'fa fa-users',
                        // use ResourceType.work locale for the button
                        text    : 'L{ResourceType.work}',
                        pressed : true,
                        value   : 'work'
                    },
                    materialResources : {
                        icon    : 'fa fa-cubes-stacked',
                        // use ResourceType.material locale for the button
                        text    : 'L{ResourceType.material}',
                        pressed : true,
                        value   : 'material'
                    },
                    costResources : {
                        icon    : 'fa fa-sack-dollar',
                        // use ResourceType.cost locale for the button
                        text    : 'L{ResourceType.cost}',
                        pressed : true,
                        value   : 'cost'
                    }
                }
            },
            // Dummy text field to give toolbar same height as in Gantt
            dummyTextField : {
                type  : 'textfield',
                cls   : 'b-hide-visibility',
                label : 'Dummy'
            }
        }
    };

    get resourceGrid() {
        return this._resourceGrid || (this._resourceGrid = this.owner);
    }

    onFilterByTypeChange({ value }) {
        this.resourceGrid.store.addFilter({
            id       : 'resource-type-filter',
            property : 'type',
            value    : value.split(','),
            operator : 'isIncludedIn'
        });
    }

    onGanttButtonClick() {
        this.widgetMap.resourceViewButton.pressed = true;
        this.resourceGrid.hidden = true;
        this.gantt.hidden = false;
    }

    async onAddResourceClick() {
        const
            { resourceGrid } = this,
            [added] = resourceGrid.store.add({ name : 'New resource' });

        // run propagation to calculate new task fields
        await resourceGrid.project.commitAsync();

        // scroll to the added task
        await resourceGrid.scrollRowIntoView(added);

        resourceGrid.features.cellEdit.startEditing({
            record : added,
            field  : 'name'
        });
    }
}

// Register this widget type with its Factory
ResourceGridToolbar.initClass();

//endregion

const project = new ProjectModel({
    autoSetConstraints : true,
    // Let the Project know we want to use our own Task model with custom fields / methods
    taskModelClass     : Task,
    loadUrl            : '../_datasets/launch-saas-advanced.json',
    autoLoad           : true,
    taskStore          : {
        wbsMode : 'auto'
    },
    // The State TrackingManager which the UndoRedo widget in the toolbar uses
    stm : {
        // NOTE, that this option does not enable the STM itself, this is done by the `undoredo` widget,
        // defined in the gantt toolbar
        // If you don't use `undoredo` widget in your app, you need to enable STM manually: `stm.enable()`,
        // otherwise, it won't be tracking changes in the data
        // It's usually best to enable STM after the initial data loading is completed.
        autoRecord : true
    },
    // Reset Undo / Redo after each load
    resetUndoRedoQueuesAfterLoad : true
});

const gantt = new Gantt({
    appendTo          : 'container',
    dependencyIdField : 'wbsCode',
    showDirty         : true,
    selectionMode     : {
        cell       : true,
        dragSelect : true,
        rowNumber  : true
    },

    project,

    // display cost related UI controls
    showCostControls : true,

    // For best initial performance, configure startDate & endDate to determine the date range that needs to be
    // rendered initially
    startDate                     : '2025-01-05',
    endDate                       : '2025-03-24',
    resourceImagePath             : '../_shared/images/transparent-users/',
    scrollTaskIntoViewOnCellClick : true,

    columns : [
        { type : 'wbs', hidden : true },
        { type : 'name', width : 250, showWbs : true },
        { type : 'cost' },
        { type : 'startdate' },
        { type : 'duration' },
        { type : 'resourceassignment', width : 120, showAvatars : true },
        { type : 'percentdone', mode : 'circle', width : 70 },
        { type : 'predecessor', width : 112 },
        { type : 'successor', width : 112 },
        { type : 'schedulingmodecolumn' },
        { type : 'calendar' },
        { type : 'constrainttype' },
        { type : 'constraintdate' },
        { type : 'statuscolumn' },
        { type : 'complexitycolumn' },
        { type : 'deadlinedate' },
        { type : 'addnew' }
    ],

    viewPreset : {
        base      : 'weekAndDayLetter',
        tickWidth : 35
    },

    subGridConfigs : {
        locked : {
            flex : 3
        },
        normal : {
            flex : 4
        }
    },

    columnLines : false,

    // Shows a color field in the task editor and a color picker in the task menu.
    // Both lets the user select the Task bar's background color
    showTaskColorPickers : true,

    features : {
        projectEdit : true,
        baselines   : {
            disabled : true
        },
        dependencies : {
            showLagInTooltip : true,
            // Soften up dependency line corners
            radius           : 3,
            // Make dependencies easier to reach using the mouse
            clickWidth       : 5
        },
        dependencyEdit : true,
        filter         : true,
        labels         : {
            before : {
                field  : 'name',
                editor : {
                    type : 'textfield'
                }
            }
        },
        parentArea : {
            disabled : true
        },
        progressLine : {
            disabled   : true,
            statusDate : new Date(2025, 0, 25)
        },
        rollups : {
            disabled : true
        },
        rowResize : {
            cellSelector : '.b-sequence-cell'
        },
        rowReorder : {
            showGrip        : 'hover',
            preserveSorters : true
        },
        timeRanges : {
            showCurrentTimeLine : true
        },
        fillHandle    : true,
        cellCopyPaste : true,
        taskCopyPaste : {
            useNativeClipboard : true
        },
        taskDrag : {
            dragAllSelectedTasks : true
        }
    },

    tbar : {
        type : 'gantttoolbar'
    }
});

let resourceGrid;

// Let toolbars know of other view references
Object.defineProperty(gantt.tbar, 'resourceGrid', {
    get() {
        if (!resourceGrid) {
            resourceGrid = new ResourceGrid({
                appendTo          : 'container',
                // resource grid is hidden initially
                hidden            : true,
                project,
                resourceImagePath : '../_shared/images/transparent-users/',
                columns           : {
                    data : {
                        // override default cost column
                        cost : {
                            // rollup cost to the groups
                            sum : 'sum'
                        },
                        // override default name column
                        name : {
                            // change its type to resourceInfo to show resource images
                            type           : 'resourceInfo',
                            // don't use event count - it works for Scheduler based views only
                            showEventCount : false,
                            width          : 200
                        },
                        // add new "City" column
                        city : {
                            text  : 'City',
                            field : 'city'
                        }
                    }
                },
                features : {
                    // group by resource type (work, material or cost)
                    group : {
                        field : 'type'
                    },
                    // display groups summary (used for rolling up cost)
                    groupSummary : {
                        target : 'header'
                    },
                    // enable resource editor dialog
                    resourceEdit : true
                },
                tbar : {
                    type : 'resourcegridtoolbar',
                    gantt
                }
            });
        }
        return resourceGrid;
    }
});
