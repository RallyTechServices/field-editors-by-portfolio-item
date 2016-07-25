
Ext.define('CA.techservices.ModelTypeCombo', {
    alias: 'widget.tsmodeltypecombo',
    extend: 'Rally.ui.combobox.ComboBox',
//    plugins: [{
//        ptype: 'rallypreferenceenabledcombobox',
//        preferenceName: 'piTypeCombo'
//    }],

    constructor: function(config) {
        
        var filters = [
            {property:'TypePath',operator:'contains',value:'PortfolioItem/'},
            {property:'TypePath',value:'HierarchicalRequirement'},
            {property:'TypePath',value:'Defect'}
        ];
        
        
        var defaultConfig = {
            defaultSelectionPosition: 'last',
            editable: false,
            fieldLabel: 'Type:', // delete this when removing PORTFOLIO_ITEM_TREE_GRID_PAGE_OPT_IN toggle. Only used on old Ext2 page.
            labelWidth: 30,      // delete this when removing PORTFOLIO_ITEM_TREE_GRID_PAGE_OPT_IN toggle. Only used on old Ext2 page.
            context: Rally.environment.getContext(),
            displayField: 'DisplayName',
            storeConfig: {
                autoLoad: true,
                remoteFilter: true,
                model: Ext.identityFn('TypeDefinition'),
                sorters: {
                    property: 'Ordinal',
                    direction: 'Desc'
                },
                filters: Rally.data.wsapi.Filter.or(filters)
//                filters: [
//                    {
//                        property: 'Parent.Name',
//                        operator: '=',
//                        value: 'Portfolio Item'
//                    },
//                    {
//                        property: 'Creatable',
//                        operator: '=',
//                        value: 'true'
//                    }
//                ]
            }
        };

        if (config.storeConfig) {
            delete config.storeConfig.autoLoad;

            if (config.storeConfig.additionalFilters) {
                defaultConfig.storeConfig.filters = defaultConfig.storeConfig.filters.concat(config.storeConfig.additionalFilters);
            }
        }

        this.callParent([Ext.Object.merge(defaultConfig, config)]);
    },

    getSelectedType: function () {
        return this.getTypeFromRef(this.getValue());
    },

    getTypeFromRef: function (typeRef) {
        return this.getStore().findRecord('_ref', typeRef);
    },

    getTypeWithOrdinal: function(ordinal) {
        return this.getStore().findRecord("Ordinal", ordinal);
    },

    getAllTypeNames: function () {
        return _.map(this.getStore().getRecords(), function (type) { return type.get('TypePath'); });
    },

    getCurrentView: function () {
        return {piTypePicker: this.getRecord().get('_refObjectUUID')};
    }
});