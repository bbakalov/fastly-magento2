<?php

namespace Fastly\Cdn\Controller\Adminhtml\FastlyCdn\Edge\Auth;

use Fastly\Cdn\Controller\Adminhtml\FastlyCdn\Vcl\CheckAuthSetting;
use Fastly\Cdn\Model\Api;
use Magento\Backend\App\Action;
use Magento\Backend\App\Action\Context;
use Magento\Framework\App\Request\Http;
use Magento\Framework\Controller\Result\JsonFactory;
use Fastly\Cdn\Model\Config;
use Fastly\Cdn\Helper\Vcl;

class Delete extends Action
{
    /**
     * @var Http
     */
    private $request;

    /**
     * @var JsonFactory
     */
    private $resultJson;

    /**
     * @var Config
     */
    private $config;

    /**
     * @var Api
     */
    private $api;

    /**
     * @var Vcl
     */
    private $vcl;

    /**
     * ForceTls constructor.
     *
     * @param Context $context
     * @param Http $request
     * @param JsonFactory $resultJsonFactory
     * @param Config $config
     * @param Api $api
     * @param Vcl $vcl
     */
    public function __construct(
        Context $context,
        Http $request,
        JsonFactory $resultJsonFactory,
        Config $config,
        Api $api,
        Vcl $vcl
    ) {
        $this->request = $request;
        $this->resultJson = $resultJsonFactory;
        $this->config = $config;
        $this->api = $api;
        $this->vcl = $vcl;

        parent::__construct($context);
    }

    public function execute()
    {
        $result = $this->resultJson->create();

        try {
            $activeVersion = $this->getRequest()->getParam('active_version');
            $activateVcl = $this->getRequest()->getParam('activate_flag');
            $service = $this->api->checkServiceDetails();

            if (!$service) {
                return $result->setData([
                    'status'    => false,
                    'msg'       => 'Failed to check Service details.'
                ]);
            }

            $currActiveVersion = $this->vcl->determineVersions($service->versions);

            if ($currActiveVersion['active_version'] != $activeVersion) {
                return $result->setData([
                    'status'    => false,
                    'msg'       => 'Active versions mismatch.'
                ]);
            }

            // Check dictionary
            $dictionaryName = CheckAuthSetting::AUTH_DICTIONARY_NAME;
            $dictionary = $this->api->getSingleDictionary($activeVersion, $dictionaryName);

            if ((is_array($dictionary) && empty($dictionary)) || $dictionary == false) {
                return $result->setData([
                    'status'        => false,
                    'not_exists'    => true,
                    'msg'           => 'Authentication dictionary does not exist. Nothing to remove.'
                ]);
            }

            $clone = $this->api->cloneVersion($currActiveVersion['active_version']);

            if (!$clone) {
                return $result->setData([
                    'status'    => false,
                    'msg'       => 'Failed to clone active version.'
                ]);
            }

            $vclPath = CheckAuthSetting::VCL_AUTH_SNIPPET_PATH;
            $snippets = $this->config->getVclSnippets($vclPath);

            // Remove snippets
            foreach ($snippets as $key => $value) {
                $name = Config::FASTLY_MAGENTO_MODULE . '_basic_auth_' . $key;
                $status = $this->api->removeSnippet($clone->number, $name);
            }

            $deleteDictionary = $this->api->deleteDictionary($clone->number, $dictionaryName);

            if (!$deleteDictionary) {
                return $result->setData([
                    'status'    => false,
                    'msg'       => 'Failed to delete Auth Dictionary.'
                ]);
            }

            $validate = $this->api->validateServiceVersion($clone->number);

            if ($validate->status == 'error') {
                return $result->setData([
                    'status'    => false,
                    'msg'       => 'Failed to validate service version: ' . $validate->msg
                ]);
            }

            if ($activateVcl === 'true') {
                $this->api->activateVersion($clone->number);
            }

            return $result->setData([
                'status'            => true,
                'active_version'    => $clone->number
            ]);
        } catch (\Exception $e) {
            return $result->setData([
                'status'    => false,
                'msg'       => $e->getMessage()
            ]);
        }
    }
}
