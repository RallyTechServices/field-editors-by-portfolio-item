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
    pis_by_rev_history_oid: {}, // key is OID of RevisionHistory

    integrationHeaders : {
        name : "TSFieldEditorsByPI"
    },

    config: {
        defaultSettings: {
            timeboxType: 'Dates',
            useIndividualItem: false
        }
    },

    launch: function() {
        this._getPortfolioItemTypes().then({
            success: function(types) {
                this.pi_paths = Ext.Array.map(types, function(type){
                    return type.get('TypePath');
                });

                this.logger.log('typepaths', this.pi_paths);

                this.timeboxType = this.getSetting('timeboxType');
                this.useIndividualItem = this.getSetting('useIndividualItem');
                this._addSelectors();
            },
            failure: function(msg) {
                Ext.Msg.alert('',msg);
            },
            scope: this
        });
    },

    _addSelectors: function() {
        var container = this.down('#selector_box');
        container.removeAll();

        var type_container = container.add({
            xtype:'container',
            layout: 'vbox',
            itemId: 'ctFieldPicker'
        });


        if ( this.useIndividualItem ) {
            type_container.add({
                xtype:'portfolioitempickerbutton',
                layout: 'hbox',
                artifactTypes: this.pi_paths,
                listeners: {
                    scope: this,
                    itemschosen: this.updateFieldPickerForIndividualItem
                }
            });
        } else {
            type_container.add({
                xtype: 'tsmodeltypecombo',
                fieldLabel: 'Type:',
                labelWidth: 55,
                labelAlign: 'right',
                width: 300,
                listeners: {
                    scope: this,
                    change: this.updateFieldPicker
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

        container.add({
            xtype: 'container',
            flex: 1
        });

        container.add({
            xtype: 'rallybutton',
            iconCls: 'icon-export',
            align: 'right',
            cls: 'rly-small secondary',
            itemId: 'exportButton',
            disabled: true,
            listeners: {
                click: this.export,
                scope: this
            }
        });

    },
    getTypeContainer: function(){
        return this.down('#ctFieldPicker');
    },
    updateFieldPickerForIndividualItem: function(picker, items){
        this.logger.log('updateFieldPickerForIndividualItem chosen:', items);
        this.PIs = items;
        if ( this.PIs.length === 0 ) { return; }
        //this.addFieldPicker(this.PIs[0].get('_type'));
        this.addMultiFieldPicker(this.PIs[0].get('_type'));
    },
    updateFieldPicker: function(cb){
        this.piType = cb.getRecord();
        //this.addFieldPicker(this.piType.get('TypePath'));
        this.addMultiFieldPicker(this.piType.get('TypePath'));
    },
    addMultiFieldPicker: function(typePath){
        var type_container = this.getTypeContainer();

        this._enableGoButton();

        if ( type_container.down('rallyfieldpicker') ) { type_container.down('rallyfieldpicker').destroy(); }

        type_container.add({
            xtype: 'rallyfieldpicker',
            modelTypes: [typePath],
            fieldLabel: 'Fields:',
            labelWidth: 55,
            alwaysExpanded: false,
            margin: '10px 0 10px 0',
            width: 300,
            labelAlign: 'right',
            fieldBlackList: ['Workspace','Attachments','Changesets'],

            listeners: {
                scope: this,
                selectionchange: this._enableGoButton
            }
        });

    },
    getSelectedFields: function(){
        var fields = this.down('rallyfieldpicker') && this.down('rallyfieldpicker').getValue() || [];
        this.logger.log('getFields',fields);
        return fields;
    },
    addFieldPicker: function(typePath){
        var type_container = this.getTypeContainer();

        this._enableGoButton();

        if ( type_container.down('rallyfieldcombobox') ) { type_container.down('rallyfieldcombobox').destroy(); }

        type_container.add({
            xtype: 'rallyfieldcombobox',
            model: typePath,
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
    },
    export: function(){
        var records = this.down('rallygrid') && this.down('rallygrid').getStore() && this.down('rallygrid').getStore().getRange();
        this.logger.log('export', records);
        var csv = [],
            fileName = Ext.String.format("editors-{0}.csv",Rally.util.DateTime.format(new Date(), 'Y-m-d-h-i-s')),
            columns = this._getColumns();

        var headers = Ext.Array.map(columns, function(c){
            return c.text;
        });
        csv.push(headers.join(","));

        Ext.Array.each(records, function(r){
            var row = [];
            Ext.Array.each(columns, function(c){
                var val = r.get(c.dataIndex) || "";
                if (val && c.renderer){
                    val = c.renderer(val,{},r);
                }
                row.push(val);
            });
            row = _.map(row, function(v){ return Ext.String.format("\"{0}\"", v.toString().replace(/"/g, "\"\""));});
            csv.push(row.join(","));
        });
        csv = csv.join("\r\n");
        CArABU.technicalservices.FileUtility.saveCSVToFile(csv,fileName);
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

        var fields = this.getSelectedFields();
        if ( Ext.isEmpty(fields) || fields.length === 0 ) { return; }

        this.logger.log('PIs', this.PIs, ' Type:', this.piType);

        button.setDisabled(false);
    },

    _enableExportButton: function(enable){
        var button = this.down('#exportButton');
        if (!button) {return;}
        if (enable === true){
            button.setDisabled(false);
        } else {
            button.setDisabled(true);
        }

    },

    _updateData: function() {
        this.down('#display_box').removeAll();

        var me = this,
            PIs = this.PIs || [],
            type = this.piType || null,
            fields = this.getSelectedFields(),
            //field = this.field,
            users = this.users || [],
            end_date = this.endDate,
            start_date = this.startDate,
            release = this.release;

        this.setLoading('Loading Revisions');

        this._getPIs(type, PIs).then({
            scope: this,
            success: function(pis) {
                this.logger.log("Found items:", pis.length);

                var filters =  [{property:'ObjectID',value:-1}];

                if ( pis.length === 0 ) {
                    this.setLoading(false);
                    this.down('#display_box').add({xtype:'container',html:'No data'});
                } else {
                    var chunks = this._getRevisionChunks(pis,fields,start_date,end_date);
                    this.logger.log('Split promises:', chunks.length);

                    TSUtilities.throttle(chunks,6,this).then({
                        scope: this,
                        success: function(revisions){
                            revisions = Ext.Array.flatten(revisions);
                            this.logger.log('revisions:', revisions);

                            var filtered_records = Ext.Array.filter(revisions, function(revision){
                                return !Ext.Array.contains(users, revision.get('User')._ref);
                            });

                            var data = Ext.Array.map(filtered_records, function(record){
                                var item = record.getData();
                                var rev_history_oid = item.RevisionHistory.ObjectID;
                                item.__pi = me.pis_by_rev_history_oid[rev_history_oid];
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
                }
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem loading ' + type.get('ElementName'), msg);
            }

        });
    },

    // returns an array of functions so that we aren't
    // asking for 2500 revision histories at once
    _getRevisionChunks: function(items,fields,start_date,end_date) {
        var me = this;
        var name_filters = [];
        Ext.Array.each(fields, function(f){
            var field_display_name = f.get('displayName');
            var field_internal_name = f.get('name');

            name_filters.push({property:'Description',operator:'contains',value:field_display_name});
            name_filters.push({property:'Description',operator:'contains',value:field_internal_name});
        });

        name_filters = Rally.data.wsapi.Filter.or(name_filters);

        var total = items.length;
        var page_size = 500;
        var page_count = Math.ceil(total/page_size);
        var promises = [];

        Ext.Array.each(_.range(0,page_count),function(page_index){
            var start = page_index*page_size;
            var end = start + page_size;
            me.logger.log(start,end,total);
            var items_subset = Ext.Array.slice(items,start,end);
            var history_filters = Rally.data.wsapi.Filter.or(
                Ext.Array.map(items_subset, function(item){
                    var revision_history = item.get('RevisionHistory');
                    var oid = revision_history.ObjectID;
                    // keep pi around so we can refer to it later
                    me.pis_by_rev_history_oid[oid] = item;
                    return {property:'RevisionHistory.ObjectID',value:oid};
                })
            );
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

            var config = {
                model:'Revision',
                filters: filters,
                fetch: ['ObjectID','RevisionHistory','CreationDate','User','RevisionNumber','Description'],
                limit: Infinity,
                pageSize: 2000,
                enablePostGet: true,
                sorters: [{property:'CreationDate',direction:'DESC'}]
            };
            promises.push(function(){return TSUtilities.loadWsapiRecords(config);});
        });

        return promises;
    },

    _getPIs: function(type, pis) {
        var model = null;
        var start_date = this.startDate;

        var filters = Rally.data.wsapi.Filter.and([{property:'ObjectID',operator:'>',value:-1}]);

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
                filters = Rally.data.wsapi.Filter.and([{property:'Release.Name',value:this.release.get('Name')}]);
            }
        }

        if (start_date) {
            filters = filters.and(Ext.create('Rally.data.wsapi.Filter',{
                property: 'LastUpdateDate',
                operator: '>=',
                value: Rally.util.DateTime.toIsoString(start_date)
            }));
        }


        var config = {
            limit: Infinity,
            pageSize: 2000,
            model: model,
            filters: filters,
            fetch: ['FormattedID','RevisionHistory','Project','Name','ObjectID']
        };
        return TSUtilities.loadWsapiRecords(config);
    },

    _isTypeWithRelease: function(type){
        return type.get('Ordinal') < 1 ;
    },

    _getPortfolioItemTypes: function() {
        var deferred = Ext.create('Deft.Deferred');

        var store = Ext.create('Rally.data.wsapi.Store', {
            fetch: ['Name','ElementName','TypePath'],
            model: 'TypeDefinition',
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ],
            autoLoad: true,
            listeners: {
                load: function(store, records, successful) {
                    if (successful){
                        deferred.resolve(records);
                    } else {
                        deferred.reject('Failed to load types');
                    }
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

        this._enableExportButton(records.length > 0);
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
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
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
            xtype          : 'rallycombobox',
            name           : 'timeboxType',
           // id             : 'timeboxType',
            store          : ['Dates', 'Release'],
            fieldLabel     : 'Type of Timebox',
            labelWidth     : 105,
            labelAlign     : 'right',
            width          : 247
            //readyEvent     : 'ready'
        },
        {
            xtype: 'rallycheckboxfield',
            name: 'useIndividualItem',
            boxLabelAlign: 'after',
            fieldLabel: '',
            margin: '0 0 25 200',
            boxLabel: 'Use Individual Item Picker<br/><span style="color:#999999;"><i>Tick to use allow user to pick a single item for review.  Otherwise, they have to chose a record type.</i></span>'
        }];
    }
});
