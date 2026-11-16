<?php

namespace App;

final class Website
{
    public static function host(?string $website): string|false|null
    {
        $website = trim((string) $website);
        if ($website === '') {
            return null;
        }

        if (!preg_match('#^[a-z][a-z0-9+.-]*://#i', $website)) {
            $website = 'https://'.$website;
        }

        $parts = parse_url($website);
        $host = strtolower($parts['host'] ?? '');
        if (!in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || isset($parts['user']) || isset($parts['pass'])) {
            return false;
        }

        $host = preg_replace('/^www\./', '', rtrim($host, '.'));
        if (strlen($host) > 253 || !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/', $host)) {
            return false;
        }

        return $host;
    }

    public static function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
