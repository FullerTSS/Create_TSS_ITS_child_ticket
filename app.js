(function() {
  return {
    childRegex: /child_of:(\d*)/,
    parentRegex: /(?:father_of|parent_of):(\d*)/, //father_of is here to ensure compatibility with older versions
    formDescription: function(val){ return this.formGetOrSet('.description', val); },

    events: {
      // APP EVENTS
      'app.activated'                   : 'onActivated',
      'ticket.status.changed'           : 'loadIfDataReady',
      // AJAX EVENTS
      'createChildTicket.done'          : 'createChildTicketDone',
      'fetchTicket.done'                : 'fetchTicketDone',
      'fetchGroups.done'                : function(data){ this.fillGroupWithCollection(data.groups); },
      'createChildTicket.fail'          : 'genericAjaxFailure',
      'updateTicket.fail'               : 'genericAjaxFailure',
      'fetchTicket.fail'                : 'displayHome',
      'autocompleteRequester.fail'      : 'genericAjaxFailure',
      'fetchGroups.fail'                : 'genericAjaxFailure',
      'fetchUsersFromGroup.fail'        : 'genericAjaxFailure',
        //my event
      // 'fetchUser.fail'                  : 'genericAjaxFailure',
      // DOM EVENTS
      'click .new-linked-ticket'        : 'displayForm',
      'click .create-linked-ticket'     : 'create',
      'click .copy_description'         : 'copyDescription',
      'change select[name=requester_type]' : 'handleRequesterTypeChange',
      'change select[name=assignee_type]' : function(event){
        if (this.$(event.target).val() == 'custom')
          return this.formAssigneeFields().show();
        return this.formAssigneeFields().hide();
      },
      'change .group'                   : 'groupChanged',
      'click .token .delete'            : function(e) { this.$(e.target).parent('li.token').remove(); },
      'keypress .add_token input'       : function(e) { if(e.charCode === 13) { this.formTokenInput(e.target, true);}},
      'input .add_token input'            : function(e) { this.formTokenInput(e.target); },
      'focusout .add_token input'         : function(e) { this.formTokenInput(e.target,true); },
      'focusout .linked_ticket_form [required]' : 'handleRequiredFieldFocusout'
    },

    requests: {
      createChildTicket: function(ticket){
        return {
          url: '/api/v2/tickets.json',
          dataType: 'json',
          data: JSON.stringify(ticket),
          processData: false,
          contentType: 'application/json',
          type: 'POST'
        };
      },
      updateTicket: function(id, data){
        return {
          url: '/api/v2/tickets/'+ id +'.json',
          dataType: 'json',
          data: JSON.stringify(data),
          processData: false,
          contentType: 'application/json',
          type: 'PUT'
        };
      },
      fetchTicket: function(id){
        return {
          url: '/api/v2/tickets/' + id + '.json?include=groups,users',
          dataType: 'json',
          type: 'GET'
        };
      },
      autocompleteRequester: function(email){
        return {
          url: '/api/v2/users/autocomplete.json?name=' + email,
          type: 'POST'
        };
      },
      fetchGroups: function(){
        return {
          url: '/api/v2/groups/assignable.json',
          type: 'GET'
        };
      },
      fetchUsersFromGroup: function(group_id){
        return {
          url: '/api/v2/groups/' + group_id + '/users.json',
          type: 'GET'
        };
      },
      fetchUser: function(user_id){
        return {
          url: '/api/v2/users/' + user_id + '.json',
          type: 'GET',
          dataType: 'json'
        };
      },
      paginatedRequest: function(request, page, args) {
        var requestArgs = this.requests[request];
        if (_.isFunction(requestArgs)) {
          requestArgs = requestArgs.apply(this, args);
        }
        requestArgs.url += (/\?/.test(requestArgs.url)) ? '&page=' + page : '?page=' + page;
        return requestArgs;
      }
    },

    onActivated: function(data) {
      _.defer(function() {
        if (this.hideAncestryField()) {
          this.loadIfDataReady();
        }
      }.bind(this));
    },

    loadIfDataReady: function(){
      if (this.ticket() &&
          this.ticket().id() &&
          !_.isUndefined(this.ancestryValue())){

        if (this.hasChild() || this.hasParent())
          return this.ajax('fetchTicket', this.childID() || this.parentID());

        this.displayHome();
      }
    },

    displayHome: function(){
      this.switchTo('home', {
        closed_warn: this.ticket().status() == "closed"
      });
    },

    displayForm: function(event){
      event.preventDefault();
// disable ticket submit button so that HR doesn't accidentally use it.
      this.disableSave();

      this.paginateRequest('fetchGroups').then(function(data){
        this.fillGroupWithCollection(data.groups);
      }.bind(this));

      this.switchTo('form', {
        current_user: {
          email: this.currentUser().email()
        },
        closed_warn: this.ticket().status() == "closed",
        tags: this.tags(),
        ccs: this.ccs(),
        HR_employee: {

          // this.paginateRequest('fetchUser', 555100100).then
          // email: "Automagically Assigned"
          // email: this.fetchUser(555100100).name().toString()
          // email: this.ajax('fetchUser', '555100100')
        }
      });

// set the initial ticket text to new hire placeholders and copy the original description
      this.copyDescription();
    },

    create: function(event){
      event.preventDefault();

      if (this.formIsValid()){
        var attributes = this.childTicketAttributes();

        this.spinnerOn();
        this.disableSubmit();

        this.ajax('createChildTicket', attributes)
          .always(function(){
            this.spinnerOff();
            this.enableSubmit();
          });
      }
    },

    // FORM RELATED

    formSubject: function(val){ return this.formGetOrSet('.subject', val); },
    // formDescription: function(val){ return this.formGetOrSet('.description', val); },
    formGroup: function(val){return this.formGetOrSet('.group', val); },
    formAssignee: function(val){return this.formGetOrSet('.assignee', val); },
    formRequesterEmail: function(val){return this.formGetOrSet('.requester_email', val); },
    formRequesterName: function(val){return this.formGetOrSet('.requester_name', val); },

    formGetOrSet: function(selector, val){
      if (_.isUndefined(val))
        return this.$(selector).val();
      return this.$(selector).val(val);
    },

    formRequesterType: function(){
      return this.$('select[name=requester_type]').val();
    },

    formRequesterFields: function(){
      return this.$('.requester_fields');
    },

    formAssigneeFields: function(){
      return this.$('.assignee_fields');
    },

    formAssigneeType: function(){
      return this.$('select[name=assignee_type]').val();
    },

    formToken: function(type){
      return _.map(this.$('.'+type+' li.token span'), function(i){ return i.innerHTML; });
    },

    formTokenInput: function(el, force){
      var input = this.$(el);
      var value = input.val();

      if ((value.indexOf(' ') >= 0) || force){
        _.each(_.compact(value.split(' ')), function(token){
          var li = '<li class="token"><span>'+token+'</span><a class="delete" tabindex="-1">×</a></li>';
          this.$(el).before(li);
        }, this);
        input.val('');
      }
    },

    fillGroupWithCollection: function(collection){
      return this.$('.group').html(this.htmlOptionsFor(collection));
    },

    fillAssigneeWithCollection: function(collection){
      return this.$('.assignee').html(this.htmlOptionsFor(collection));
    },

    formShowAssignee: function(){
      return this.$('.assignee-group').show();
    },

    formHideAssignee: function(){
      return this.$('.assignee-group').hide();
    },

    disableSubmit: function(){
      return this.$('.btn').prop('disabled', true);
    },

    enableSubmit: function(){
      return this.$('.btn').prop('disabled', false);
    },

    htmlOptionsFor:  function(collection){
      var options = '<option>-</option>';

      _.each(collection, function(item){
        options += '<option value="'+item.id+'">'+(item.name || item.title)+'</option>';
      });

      return options;
    },

    formIsValid: function(){
      var requiredFields = this.$('form.linked_ticket_form [required]'),
          validatedFields = this.validateFormFields(requiredFields);

      return _.all(validatedFields, function(validatedField) {
        return validatedField === true;
      }, this);
    },

    validateFormFields: function(fields){
      var validatedFields = [];

      _.each(fields, function(field) {
        var isValid = this.validateField(field);
        validatedFields.push(isValid);
      }, this);

      return validatedFields;
    },

    validateField: function(field) {
      var viewField = this.$(field),
      valid = !_.isEmpty(viewField.val());

      if (valid){
        viewField.parents('.control-group').removeClass('error');
        return true;
      } else {
        viewField.parents('.control-group').addClass('error');
        return false;
      }
    },

    handleRequiredFieldFocusout: function(event) {
      this.validateField(event.currentTarget);
    },

    spinnerOff: function(){
      this.$('.spinner').hide();
    },

    spinnerOn: function(){
      this.$('.spinner').show();
    },

    // EVENT CALLBACKS

    fetchTicketDone: function(data){
      var assignee = _.find(data.users, function(user){
        return user.id == data.ticket.assignee_id;
      });

      var custom_field = _.find(data.ticket.custom_fields, function(field){
        return field.id == this.ancestryFieldId();
      }, this);

      var is_child = this.childRegex.test(custom_field.value);


      var group = _.find(data.groups, function(item){
        return item.id == data.ticket.group_id;
      });

      if (assignee)
        assignee = assignee.name;

      data.ticket.locale = {};
      _.each(['status', 'type'], (function(name) {
        data.ticket.locale[name] = this.localizeTicketValue(name, data.ticket[name]);
      }).bind(this));

      var parent_closed = false;

      if(this.ticket().status() == "closed") {
        parent_closed = true;
      }
      this.switchTo('has_relation', { ticket: data.ticket,
                                      is_child: is_child,
                                      assignee: assignee,
                                      group: group,
                                      closed_warn: parent_closed
                                    });
    },

    localizeTicketValue: function(name, value) {
      var path = helpers.fmt("ticket.values.%@.%@", name, value);
      return this.I18n.t(path);
    },

    createChildTicketDone: function(data){
      var value = "parent_of:" + data.ticket.id;

      if(this.ticket().status() != "closed") {
        this.ticket().customField("custom_field_" + this.ancestryFieldId(),value);
        // added ajax call to solve ticket
        this.ajax('updateTicket',
                  this.ticket().id(),
                  { "ticket": { "custom_fields": [
                    { "id": this.ancestryFieldId(), "value": value }
                  ], "status": "solved"}});
      }

      this.ajax('fetchTicket', data.ticket.id);
      this.spinnerOff();
      this.enableSave();
    },

    copyDescription: function(){

      //Creating User Name variable to put at the end of the delimiter
      var currentUserName = this.currentUser().name() + "\n";

      // set the initial ticket text to new hire placeholders
      var descriptionDelimiter = helpers.fmt("%@ \n------------------ \n", this.I18n.t("delimiter") + currentUserName);

      if (this.requestType() == "termination")
        descriptionDelimiter = helpers.fmt("%@ \n------------------ \n", this.I18n.t("delimiterTermination") + currentUserName);

      var description = this.formDescription()
        .split(descriptionDelimiter);

      var ret = description[0];

      if (description.length === 1)
        ret += descriptionDelimiter + this.ticket().description();

      this.formDescription(ret);
    },

    bindAutocompleteOnRequesterEmail: function(){
      var self = this;

      // bypass this.form to bind the autocomplete.
      this.$('.requester_email').autocomplete({
        minLength: 3,
        source: function(request, response) {
          self.ajax('autocompleteRequester', request.term).done(function(data){
            response(_.map(data.users, function(user){
              return {"label": user.email, "value": user.email};
            }));
          });
        },
        select: function() {
          self.$('.requester_name').prop('required', false);
          self.$('.requester_fields .control-group').removeClass('error');
        }
      });
    },

    handleRequesterTypeChange: function(event){
      var self = this,
          fields = this.formRequesterFields().find('input');

      if (this.$(event.target).val() == 'custom') {
        this.formRequesterFields().show();
        fields.prop('required', true);
      } else {
        this.formRequesterFields().hide();
        fields.prop('required', false);
      }
    },

    groupChanged: function(){
      var group_id = Number(this.formGroup());

      if (!_.isFinite(group_id)) {
        return this.formHideAssignee();
      }

      this.spinnerOn();

      this
        .paginateRequest('fetchUsersFromGroup', group_id)
        .done(function(data){
          this.formShowAssignee();
          this.fillAssigneeWithCollection(data.users);
        }.bind(this))
        .always(function(){ this.spinnerOff(); }.bind(this));
    },

    genericAjaxFailure: function(){
      services.notify(this.I18n.t('ajax_failure'), 'error');
    },

    // FORM TO JSON

    childTicketAttributes: function(){
      var params = {
        "subject": "HR - " + this.ticket().subject(),
        "comment": { "body": this.formDescription() },
        "custom_fields": [
          { id: this.ancestryFieldId(), value: 'child_of:' + this.ticket().id() }
        ]
      };

      _.extend(params,
               this.serializeRequesterAttributes(),
               this.serializeAssigneeAttributes(),
               this.serializeTagAttributes()
              );
      return { "ticket": params };
    },

    serializeTagAttributes: function(){
      var attributes = { tags: [] };
      var tags = this.formToken('tags');
      var ccs = this.formToken('ccs');

      if (tags)
        attributes.tags = tags;

      if (ccs)
        attributes.collaborators = ccs;

      return attributes;
    },

    serializeAssigneeAttributes: function(){
      var type = this.formAssigneeType();
      var attributes = {};
      var itsGroupID = 21052840;
      var tssGroupID = 20977320;

      // Very nice looking if/elseif/if/if/elseif/if/if
      // see: http://i.imgur.com/XA7BG5N.jpg

      // if TSS/ITS is selected as the assignee on the form, base the assignee off of the request type (custom_field_21875064)
        if (type == 'TSS_ITS'){
          if (this.requestType() == 'termination')
            attributes.group_id = itsGroupID;
          else
            attributes.group_id = tssGroupID;
        }
        else if (type == 'current_user'){
        attributes.assignee_id = this.currentUser().id();
      } else if (type == 'ticket_assignee' &&
                 this.ticket().assignee()) {

        if (this.ticket().assignee().user()){
          attributes.assignee_id = this.ticket().assignee().user().id();
        }
        if (this.ticket().assignee().group()){
          attributes.group_id = this.ticket().assignee().group().id();
        }
      } else if (type == 'custom' &&
                 (this.formGroup() || this.formAssignee())){
        var group_id = Number(this.formGroup());
        var assignee_id = Number(this.formAssignee());

        if (_.isFinite(group_id))
          attributes.group_id = group_id;

        if (_.isFinite(assignee_id))
          attributes.assignee_id = assignee_id;
      }

      return attributes;
    },

    serializeRequesterAttributes: function(){
      var type = this.formRequesterType();
      var attributes  = {};

      if (type == 'HR_employee'){
        attributes.requester_id = this.calculatedRequester();
      }
      else if (type == 'current_user'){
        attributes.requester_id = this.currentUser().id();
      } else if (type == 'ticket_requester' &&
                 this.ticket().requester().id()) {
        attributes.requester_id = this.ticket().requester().id();
      } else if (type == 'custom' &&
                 this.formRequesterEmail()){
        attributes.requester = {
          "email": this.formRequesterEmail(),
          "name": this.formRequesterName()
        };
      }
      return attributes;
    },

    paginateRequest: function(request, options) {
      var requestArgs = Array.prototype.slice.call(arguments, 1),
          property = /^fetch(\w+?)(?:$|From)/.exec(request)[1].toLowerCase(),
          arrayData = [],
          page = 1;

      return this.promise(function(done, fail) {
        function onSuccess(data) {
          arrayData = arrayData.concat(data[property]);
          if (data.next_page) {
            makeRequest();
          } else {
            var returnObj = {};
            returnObj[property] = arrayData;
            done.call(this, returnObj);
          }
        }

        function onFail() {
          fail.apply(this, arguments);
        }

        var makeRequest = function() {
          this.ajax.call(this, 'paginatedRequest', request, page++, requestArgs).then(onSuccess, onFail);
        }.bind(this);

        makeRequest();
      }.bind(this));
    },

    // HELPERS

    tags: function(){
      var tags = [];

      if (!_.isEmpty(this.ticket().tags()))
        tags = _.union(tags,this.ticket().tags());

      if (!_.isEmpty(this.settings.child_tag))
        tags = _.union(tags, [ this.settings.child_tag ]);

      return tags;
    },

    ccs: function(){
      return _.map(this.ticket().collaborators(), function(cc){ return cc.email(); });
    },

    hideAncestryField: function(){
      var field = this.ticketFields("custom_field_" + this.ancestryFieldId());

      if (!field){
        services.notify(this.I18n.t("ancestry_field_missing"), "error");
        return false;
      }

      return field.hide();
    },
    ancestryValue: function(){
      return this.ticket().customField("custom_field_" + this.ancestryFieldId());
    },
    ancestryFieldId: function(){
      return this.setting('ancestry_field');
    },
    hasChild: function(){
      return this.parentRegex.test(this.ancestryValue());
    },
    hasParent: function(){
      return this.childRegex.test(this.ancestryValue());
    },
    childID: function(){
      if (!this.hasChild())
        return;

      return this.parentRegex.exec(this.ancestryValue())[1];
    },
    parentID: function(){
      if (!this.hasParent())
        return;

      return this.childRegex.exec(this.ancestryValue())[1];
    },
    // if TSS/ITS is selected as the assignee on the form, base the assignee off of the request type (custom_field_21875064)
    calculatedRequester: function () {
      if (this.requestType() == 'termination')
        return this.setting('HR_termination_requester');
      else
        return this.setting('HR_new_hire_requester');
    },
    requestType: function () {
      var _reqType = this.ticket().customField("custom_field_21875064");
      if (_reqType === "hr_paperwork___terminate") {
        return "termination";
      } else if (_reqType === "hr_paperwork___hire") {
        return "newHire";
      } else {
        return "transfer";
      }
    }
  };
}());
