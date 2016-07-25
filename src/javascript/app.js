
Ext.define("TSFieldEditorsByPI", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'selector_box', defaults: { margin: 10 }, layout: 'hbox' },
        {xtype:'container',itemId:'display_box'}
    ],

    PIs: [],
    field: null,
    users: [],
    
    integrationHeaders : {
        name : "TSFieldEditorsByPI"
    },

    launch: function() {
        var me = this;
        this._addSelectors();
    },
    
    _addSelectors: function() {
        var container = this.down('#selector_box');
        container.removeAll();
        
        container.add({ 
            xtype:'portfolioitempickerbutton',
            layout: 'hbox',
            listeners: {
                scope: this,
                itemschosen: function(picker,items) {
                    this.PIs = items;
                    this._enableGoButton();
                }
            }
        });
        
        container.add({ 
            xtype: 'rallyfieldcombobox',
            model: 'PortfolioItem',
            fieldLabel: 'Field:',
            labelWidth: 55,
            _isNotHidden: function(field) {
                if ( field.hidden ) { return false; }
                if ( field.readOnly ) { return false; }
                var blacklist = ['Workspace','Attachments','Changesets'];
                
                if ( Ext.Array.contains(blacklist,field.name) ) { return false; }
                
                return true;
            },
            listeners: {
                scope: this,
                change: function(cb) {
                    this.field = cb.getRecord();
                    this._enableGoButton();
                }
            }
        });
        
        container.add({
            xtype: 'tsmultiuserpicker',
            fieldLabel: 'Allowed Users:',
            listeners: {
                change: function(picker, users) {
                    this.users = users;
                    this._updateData();
                    
                },
                scope: this
            }
        });

        container.add({
            xtype:'rallybutton',
            itemId:'go_button',
            disabled: true,
            text:'Go',
            listeners: {
                scope: this,
                click: this._updateData
            }
        });
    },
    
    _enableGoButton: function() {
        var button = this.down('#go_button');
        if ( !button ) { return; }
        button.setDisabled(true);
        
        if ( !this.PIs || this.PIs.length === 0 ) { return; }
        
        if ( Ext.isEmpty(this.field) ) { return; }
        
        button.setDisabled(false);
    },
      
    _updateData: function() {
        var me = this,
            PIs = this.PIs || [],
            field = this.field,
            users = this.users || [];
        
        this.logger.log("Review history for ", this.PIs[0].get('FormattedID'), this.PIs);
        this.setLoading('Loading Revisions');
        
        var revision_history = this.PIs[0].get('RevisionHistory');
        if ( Ext.isEmpty(revision_history) ) {
            throw "Cannot proceed without revision history";
        }
        
        var filters = Rally.data.wsapi.Filter.and([{property:'RevisionHistory.ObjectID',value:revision_history.ObjectID}]);
        
        var field_display_name = field.get('name');
        var field_internal_name = field.get('value');
        
        var name_filters =  Rally.data.wsapi.Filter.or([
            {property:'Description',operator:'contains',value:field_display_name},
            {property:'Description',operator:'contains',value:field_internal_name}
        ]);
        
        filters = filters.and(name_filters);
        
        var config = {
            model:'Revision',
            filters: filters,
            fetch: true,
            limit: 2000,
            pageSize: 2000,
            sorters: [{property:'CreationDate',direction:'DESC'}]
        };
        
        this._loadWsapiRecords(config).then({
            scope: this,
            success: function(revisions){
                this.logger.log('revisions:', revisions);
                
                var records = Ext.Array.filter(revisions, function(revision){
                    return !Ext.Array.contains(users, revision.get('User')._ref);
                });                
                me._displayGrid(records);
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem Loading Revisions', msg);
            }
        }).always(function() { me.setLoading(false); });
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    
    _displayGrid: function(records){
        this.down('#display_box').removeAll();
        
        var store = Ext.create('Rally.data.custom.Store',{ data: records });
        
        this.down('#display_box').add({
            xtype: 'rallygrid',
            store: store,
            showRowActionsColumn: false,
            columnCfgs: this._getColumns()
        });
    },
    
    _getColumns: function() {
        return [
            { dataIndex: 'CreationDate', text: 'Date' },
            { dataIndex: 'User', text: 'User', renderer: function(value,meta,record){
                if ( Ext.isEmpty(value) ) { return "None"; }
                if ( Ext.isString(value) ) { return value; }
                return value._refObjectName;
            } },
            { dataIndex: 'Description', text: 'Description', flex: 1}
        ];
    },
    
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});
