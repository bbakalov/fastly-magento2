define([
    "jquery",
    "setServiceLabel",
    "overlay",
    "resetAllMessages",
    "showErrorMessage",
    'mage/translate'
], function ($, setServiceLabel, overlay, resetAllMessages, showErrorMessage) {
    return function (config, serviceStatus, isAlreadyConfigured) {

        let domains;
        let current_domains;
        let active_version = serviceStatus.active_version;
        let errorDomainsBtnMsg = $('#fastly-error-domains-button-msg');
        let successDomainsBtnMsg = $('#fastly-success-domains-button-msg');

        let domainsListOptions = {
            title: jQuery.mage.__('Domains'),
            content: function () {
                return document.getElementById('fastly-domains-list-template').textContent;
            },
            actionOk: function () {
                pushDomains(active_version);
            }
        };

        /**
         * Trigger the Domains list call
         */
        getDomains(active_version, false).done(function (response) {
            $('.loading-domains').hide();
            if (response !== false) {
                if (response.domains.length > 0) {
                    domains = response.domains;
                    processDomains(response.domains);
                } else {
                    $('.no-domains').show();
                }
            }
        });

        /**
         * Get the list of Domains
         *
         * @param active_version
         * @param loaderVisibility
         * @returns {*}
         */
        function getDomains(active_version, loaderVisibility)
        {
            return $.ajax({
                type: "GET",
                url: config.getDomainsUrl,
                showLoader: loaderVisibility,
                data: {'active_version': active_version}
            });
        }

        /**
         * Process and display the list of Domains
         *
         * @param domains
         */
        function processDomains(domains)
        {
            $('#fastly-domains-list').html('');
            $.each(domains, function (index, domain) {
                let html = "<tr id='fastly_" + index + "'>";
                html += "<td><input data-domainId='"+ index + "' id='domain_" + index + "' value='"+ domain.name +"' disabled='disabled' class='input-text' type='text'></td></tr>";
                $('#fastly-domains-list').append(html);
            });
        }

        /**
         * Process and display the list of domains in the manage Domains modal
         *
         * @param domains
         */
        function processDomainsList(domains)
        {
            let html = '';
            $.each(domains, function (index, domain) {
                html += '<tr><td>' +
                    '<input name="domain[]" value="'+ domain.name +'" class="input-text admin__control-text dictionary-items-field" type="text" disabled></td>' +
                    '<td><input name="comment[]" value="'+ domain.comment +'" class="input-text admin__control-text dictionary-items-field" type="text" disabled></td>' +
                    '<td class="col-actions">' +
                    '<button class="action-delete remove_domain"  title="Delete" type="button"><span>Delete</span></button>' +
                    '</td></tr>';
            });
            overlay(domainsListOptions);

            if (html !== '') {
                $('#domains-list-table > tbody').html(html);
            }
        }

        function pushDomains(active_version) {
            let domains = [];
            $('input[name="domain[]"').each(function() {
                let new_domain = $(this).val();
                let new_comment = $(this).closest('tr').find("input[name='comment[]']").val();
                domains.push({
                    domain: new_domain,
                    comment: new_comment
                });
            });
            let activate_vcl = false;

            if ($('#fastly_activate_vcl').is(':checked')) {
                activate_vcl = true;
            }

            $.ajax({
                type: "POST",
                url: config.pushDomainsUrl,
                data: {
                    'active_version': active_version,
                    'activate_flag': activate_vcl,
                    'domains': domains,
                    'current_domains': current_domains
                },
                showLoader: true,
                success: function (response) {
                    if (response.status === true) {
                        successDomainsBtnMsg.text($.mage.__('Domains successfully updated.')).show();
                        active_version = response.active_version;
                        modal.modal('closeModal');
                    } else {
                        resetAllMessages();
                        modal.modal('closeModal');
                        return errorDomainsBtnMsg.text($.mage.__(response.msg)).show();
                    }
                },
                error: function () {
                    return errorDomainsBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                }
            });
        }

        /**
         * Manage domains button on click event
         */
        $('#manage-domains-button').on('click', function () {
            if (isAlreadyConfigured !== true) {
                $(this).attr('disabled', true);
                return alert($.mage.__('Please save config prior to continuing.'));
            }

            resetAllMessages();

            $.ajax({
                type: "GET",
                url: config.serviceInfoUrl,
                showLoader: true,
                success: function (service) {
                    if (service.status === false) {
                        return errorDomainsBtnMsg.text($.mage.__('Please check your Service ID and API token and try again.')).show();
                    }

                    active_version = service.active_version;
                    let next_version = service.next_version;
                    let service_name = service.service.name;

                    getDomains(active_version, true).done(function (response) {
                        if (response.status === true) {
                            processDomainsList(response.domains);
                            current_domains = response.domains;
                        } else {
                            processDomainsList([]);
                        }
                        setServiceLabel(active_version, next_version, service_name);
                    }).fail(function () {
                        return errorDomainsBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                    });
                },
                fail: function () {
                    return errorDomainsBtnMsg.text($.mage.__('An error occurred while processing your request. Please try again.')).show();
                }
            });
        });

        $('body').on('click', '#add-domain', function () {
            $('#domains-list-table > tbody').append('<tr><td>' +
                '<input name="domain[]" value="" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                '<td><input name="comment[]" value="" class="input-text admin__control-text dictionary-items-field" type="text"></td>' +
                '<td class="col-actions">' +
                '<button class="action-delete remove_domain"  title="Delete" type="button"><span>Delete</span></button>' +
                '</td></tr>');
        });

        $('body').on('click', '.remove_domain', function () {
            $(this).closest('tr').remove();
        });
    }
});
