<?php

namespace Fastly\Cdn\Model\Config\Backend;

use Magento\Config\Model\Config\Backend\Serialized\ArraySerialized;

/**
 * Extending GeoIp to handle serialization/json format difference between M2.2 and above vs prior versions
 *
 * @author Inchoo
 */
class Geoipcountry extends ArraySerialized
{

    protected function _afterLoad() // @codingStandardsIgnoreLine - required by parent class
    {
        $value = $this->getValue();

        $oldData = @unserialize($value);
        if ($oldData) {
            $oldData = (is_array($oldData)) ? $oldData : [];
            $this->setValue(empty($oldData) ? false : $oldData);
        } else {
            $this->setValue(empty($value) ? false : json_decode($value, true));
        }
    }
}
