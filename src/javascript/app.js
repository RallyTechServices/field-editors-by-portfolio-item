
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
    
    config: {
        defaultSettings: {
            timeboxType: 'Dates'
        }
    },

    launch: function() {
        var me = this;
        this.timeboxType = this.getSetting('timeboxType');
        this.useIndividualItem = this.getSetting('useIndividualItem');
        
        this._addSelectors();
    },
    
    _addSelectors: function() {
        var container = this.down('#selector_box');
        container.removeAll();

        var type_container = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        

        if ( this.useIndividualItem ) {
            type_container.add({ 
                xtype:'portfolioitempickerbutton',
                layout: 'hbox',
                listeners: {
                    scope: this,
                    itemschosen: function(picker,items) {
                        this.logger.log('chosen:', items);
                        this.PIs = items;
                        this._enableGoButton();
                        
                        if ( type_container.down('rallyfieldcombobox') ) { type_container.down('rallyfieldcombobox').destroy(); }
                        
                        if ( this.PIs.length === 0 ) { return; }
                        
                        type_container.add({ 
                            xtype: 'rallyfieldcombobox',
                            model: this.PIs[0].get('_type'),
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
                        
                    }
                }
            });
        } else {
            type_container.add({ 
                xtype: 'tsmodeltypecombo',
                
                fieldLabel: 'Type:',
                labelWidth: 55,
                listeners: {
                    scope: this,
                    change: function(cb) {
                        this.piType = cb.getRecord();
                        this._enableGoButton();
                        
                        if ( type_container.down('rallyfieldcombobox') ) { type_container.down('rallyfieldcombobox').destroy(); }
                        
                        type_container.add({ 
                            xtype: 'rallyfieldcombobox',
                            model: this.piType.get('TypePath'),
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
                    }
                }
            });
        }
        
        if ( this.timeboxType == "Dates" ) {
            this._addDateSelectors(container); 
        }
        
        if ( this.timeboxType == "Release" && this.useIndividualItem != true) {
            this._addReleaseSelector(container);
        }
        
        container.add({
            xtype: 'tsmultiuserpicker',
            fieldLabel: 'Allowed Users:',
            listeners: {
                change: function(picker, users) {
                    this.users = Ext.Array.map(users, function(user){ return user._ref; });
                    //this._updateData();
                    
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
    
    _addDateSelectors: function(container) {
        var date_container = container.add({
            xtype:'container',
            layout: 'vbox'
        });
        
        date_container.add({
            xtype: 'rallydatefield',
            itemId:'startDateSelector',
            fieldLabel:'From:',
            labelWidth:45,
            listeners: {
                scope: this,
                change: function(cb){
                    this.startDate = cb.getValue();
                }
            }
        });
        
        date_container.add({
            xtype: 'rallydatefield',
            itemId:'endDateSelector',
            fieldLabel:'To:',
            labelWidth:45,
            listeners: {
                scope: this,
                change: function(cb){
                    this.endDate = cb.getValue();
                }
            }
        });
    },
    
    _addReleaseSelector: function(container) {
        
        container.add({
            xtype: 'rallyreleasecombobox',
            itemId:'releaseSelector',
            fieldLabel:'Release:',
            labelWidth:45,
            listeners: {
                scope: this,
                change: function(cb){
                    this.release = cb.getRecord();
                }
            }
        });
    },
    
    
    _enableGoButton: function() {
        var button = this.down('#go_button');
        if ( !button ) { return; }
        button.setDisabled(true);
        
        if ( !this.piType && ( !this.PIs || this.PIs.length === 0 ) ) { return; }
        
        if ( Ext.isEmpty(this.field) ) { return; }
        
        this.logger.log('PIs', this.PIs, ' Type:', this.piType);
        
        button.setDisabled(false);
    },
      
    _updateData: function() {
        var me = this,
            PIs = this.PIs || [],
            type = this.piType || null,
            field = this.field,
            users = this.users || [],
            end_date = this.endDate,
            start_date = this.startDate,
            release = this.release;
        
        this.setLoading('Loading Revisions');
        
//        var revision_history = this.PIs[0].get('RevisionHistory');
//        if ( Ext.isEmpty(revision_history) ) {
//            throw "Cannot proceed without revision history";
//        }
        
        this._getPIs(type, PIs).then({
            scope: this,
            success: function(pis) {
                this.logger.log("Found PIs:", pis.length);
                
                var filters =  [{property:'ObjectID',value:-1}];
                
                if ( pis.length > 0 ) {
                    var pis_by_rev_history_oid = {}; // key is OID of RevisionHistory
                    var history_filters = Rally.data.wsapi.Filter.or(
                        Ext.Array.map(pis, function(pi){
                            var revision_history = pi.get('RevisionHistory');
                            var oid = revision_history.ObjectID;
                            // keep pi around so we can refer to it later
                            pis_by_rev_history_oid[oid] = pi;
                            
                            return {property:'RevisionHistory.ObjectID',value:oid};
                        })
                    );
                                    
                    var field_display_name = field.get('name');
                    var field_internal_name = field.get('value');
                    
                    var name_filters =  Rally.data.wsapi.Filter.or([
                        {property:'Description',operator:'contains',value:field_display_name},
                        {property:'Description',operator:'contains',value:field_internal_name}
                    ]);
                                    
                    var filters = name_filters.and(history_filters);
                              
                    if ( end_date ) {
                        filters = filters.and(Ext.create('Rally.data.wsapi.Filter',{
                            property: 'CreationDate', 
                            operator: '<=', 
                            value: Rally.util.DateTime.toIsoString(end_date)
                        }));
                    }
                    
                    if ( start_date ) {
                        filters = filters.and(Ext.create('Rally.data.wsapi.Filter',{
                            property: 'CreationDate', 
                            operator: '>=', 
                            value: Rally.util.DateTime.toIsoString(start_date)
                        }));
                    }
                }
                var config = {
                    model:'Revision',
                    filters: filters,
                    fetch: ['ObjectID','RevisionHistory','CreationDate','User','RevisionNumber','Description'],
                    limit: Infinity,
                    pageSize: 2000,
                    enablePostGet: true,
                    sorters: [{property:'CreationDate',direction:'DESC'}]
                };
                
                this._loadWsapiRecords(config).then({
                    scope: this,
                    success: function(revisions){
                        this.logger.log('revisions:', revisions);
                        
                        var filtered_records = Ext.Array.filter(revisions, function(revision){
                            return !Ext.Array.contains(users, revision.get('User')._ref);
                        });
                        
                        var data = Ext.Array.map(filtered_records, function(record){
                            var item = record.getData();
                            var rev_history_oid = item.RevisionHistory.ObjectID;
                            item.__pi = pis_by_rev_history_oid[rev_history_oid];
                            item.__pi_oid = item.__pi.get('ObjectID');
                            item.__pi_fid = item.__pi.get('FormattedID');
                            item.__pi_name = item.__pi.get('Name');
                            return item;
                        });
                        me._displayGrid(data);
                    },
                    failure: function(msg) {
                        Ext.Msg.alert('Problem Loading Revisions', msg);
                    }
                }).always(function() { me.setLoading(false); });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading ' + type.get('ElementName'), msg);
            }
           
        });
        
    },
    
    _getPIs: function(type, pis) {
        
        var filters = [{property:'ObjectID',operator:'>',value:-1}];
        var model = null;
        
        if ( !Ext.isEmpty(pis) && pis.length > 0 ) { 
            filters = Rally.data.wsapi.Filter.or(
                Ext.Array.map(pis, function(pi) {
                    model = pi.get('_type');
                    return { property: "ObjectID", value: pi.get('ObjectID') };
                })
            );
        } else {
        
            model = type.get('TypePath');
            if ( this._isTypeWithRelease(type) && this.release ){
                filters = [{property:'Release.Name',value:this.release.get('Name')}];
            }
        }

        
        var config = {
            limit: Infinity,
            pageSize: 2000,
            model: model,
            filters: filters,
            fetch: ['FormattedID','RevisionHistory','Project','Name','ObjectID']
        };
        return this._loadWsapiRecords(config);
    },
    
    _isTypeWithRelease: function(type){
        return type.get('Ordinal') < 1 ;
    },
    
    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Task',
            fetch: ['ObjectID']
        };
        this.logger.log("Starting load:",config.model);
        this.logger.log("config: ", config);
        
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
            { dataIndex: '__pi_oid', text: 'ID', renderer: function(value,meta,record){
               if ( Ext.isEmpty(value) ) { return ""; }
               return record.get('__pi_fid');
            }},
            { dataIndex: '__pi_name', text: 'Name' },
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
    
    getSettingsFields: function() {
        return [{
            name           : 'timeboxType',
            xtype          : 'rallycombobox',
            id             : 'timeboxType',
            store          : ['Dates', 'Release'],
            fieldLabel     : 'Type of Timebox',
            labelWidth     : 105,
            labelAlign     : 'right',
            width          : 247,
            readyEvent     : 'ready'
        },
        { 
            name: 'useIndividualItem',
            xtype: 'rallycheckboxfield',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: '0 0 25 200',
            boxLabel: 'Use Individual Item Picker<br/><span style="color:#999999;"><i>Tick to use allow user to pick a single item for review.  Otherwise, they have to chose a record type.</i></span>'
        }];
    }
});
