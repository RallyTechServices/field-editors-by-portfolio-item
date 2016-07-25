Ext.define('CA.technicalservices.UserPickerDialog',{
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.tsuserpickerdialog',
    
    width: 400,
    closable: true,
    
    selectedRecords: [],
    
    config: {
        /**
         * @cfg {String}
         * Title to give to the dialog
         */
        title: 'Choose User',

        selectionButtonText: 'Add'
        
    },
    
    items: [{
        xtype: 'panel',
        border: false,
        items: [{
            xtype:'container', 
            itemId:'selector_container',
            height: 200
        }]
    }],

    constructor: function(config) {
        this.mergeConfig(config);

        this.callParent([this.config]);
    },

    initComponent: function() {
        this.callParent(arguments);
        this.addEvents(
            /**
             * @event itemschosen
             * Fires when user clicks done after choosing item
             * @param {CA.technicalservices.UserPickerDialog} this dialog
             * @param [{Object}] items (item.getData, not the model)
             */
            'itemschosen'
        );
        
        this._buildButtons();
        this._buildDisplayBar();
        this._updateDisplay();
        
        this._buildItemGrid();
        //this._buildTree();
    },
    
    _buildDisplayBar: function() {
        this.down('panel').addDocked({
            xtype:'container',
            dock: 'top',
            padding: '0 0 10 0',
            layout: 'hbox',
            items: [{
                xtype:'container',
                itemId: 'displayBox', 
                height: 50,
                autoScroll: true
            }]
        });
    },
    
    getDisplayTemplate: function() {
        return new Ext.XTemplate(
            '<tpl for=".">',
                '<span class="project-box" id="s{ObjectID}">{_refObjectName}</span>',
            '</tpl>'
        );
    },
    
    _updateDisplay: function() {
        var container = this.down('#displayBox');
        container.removeAll();
        
        var sorted_array = Ext.Array.sort(this.selectedRecords, function(a,b) {
            if ( a.UserName < b.UserName ) { return -1; }
            if ( a.UserName > b.UserName ) { return 1; }
            return 0;
        });
                
        Ext.Array.each(sorted_array, function(record,idx){
            container.add({
                xtype:'button',
                cls: 'project-button',
                text: "<span class='icon-delete'></span> " + record.UserName,
                listeners: {
                    scope: this, 
                    click: function() {
                        this._removeItem(record);
                    }
                }
            });
        },this);
    },
    
    _removeItem: function(item) {
        this.selectedRecords = Ext.Array.remove(this.selectedRecords, item);
        this._updateDisplay();
    },
    
    _buildButtons: function() {
        this.down('panel').addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                type: 'hbox',
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    text: this.selectionButtonText,
                    cls: 'primary small',
                    scope: this,
                    userAction: 'clicked done in dialog',
                    handler: function() {
                        this.fireEvent('itemschosen', this, this.selectedRecords);
                        this.close();
                    }
                },
                {
                    xtype: 'rallybutton',
                    text: 'Cancel',
                    cls: 'secondary small',
                    handler: this.close,
                    scope: this,
                    ui: 'link'
                }
            ]
        });
    },
    
    _addRecordToSelectedRecords: function(record) {
        if ( Ext.isFunction(record.getData ) ) {
            record = record.getData();
        }
        
        // unique by objectID
        var record_hash = {};
        Ext.Array.each( Ext.Array.push(this.selectedRecords, [record] ), function(item) {
            record_hash[item.ObjectID] = item;
        });
        
        this.selectedRecords = Ext.Object.getValues(record_hash);
        this._updateDisplay();
    },
    
    _buildItemGrid: function() {
        this.selector = this.down('#selector_container').add({
            xtype:'rallytextfield',
            itemId:'searchTerms',
            emptyText: 'Type & Enter to Search Name',
            enableKeyEvents: true,
            flex: 1,
            width: '100%',
            listeners: {
                scope: this,
                keyup: function(field,evt){
                    if ( evt.getKey() === Ext.EventObject.ENTER ) {
                        this._search();
                    }
                },
                afterrender: function(field) {
                    field.focus();
                }
            }
        });
        
        var container = this.down('#selector_container').add({
            xtype:'container', 
            itemId:'selector_container',
            height: 180,
            layout: 'fit'
        });
        

        var store = Ext.create('Rally.data.wsapi.Store',{
            model:'User',
            fetch:['UserName','ObjectID'],
            pageSize: 25
        });
        
        this.grid = container.add({
            xtype:'rallygrid',
            showRowActionsColumn: false,
            enableEditing: false,
            hideHeaders: true,
            showPagingToolbar: true,
            store: store,
            columnCfgs: this._getGridColumns(),
            listeners: {
                scope: this,
                itemclick: function(grid,record) {
                    this._addRecordToSelectedRecords(record);
                }
            }
        });
    },
    
    _search: function() {
        var terms = this._getSearchTerms();        
        var store = this.grid.getStore();
        store.setFilter(null);
        if (terms) {
            store.setFilter(Rally.data.wsapi.Filter.or([
                { property:'UserName', operator:'contains', value:terms },
                { property:'FirstName',operator:'contains', value:terms },
                { property:'LastName', operator:'contains', value:terms }
            ]));
        } 
        store.loadPage(1);
    },

    _getSearchTerms: function() {
        var textBox = this.down('#searchTerms');
        return textBox && textBox.getValue();
    },
    
    _getGridColumns: function() {
        return [
            { 
                dataIndex: 'UserName', 
                text: 'Click to Add',
                flex: 1, 
                renderer: function(value,meta,record){
                    return record.get('_refObjectName') + " (" + record.get('UserName') + ")";
                } 
            }
        ];
    }
});