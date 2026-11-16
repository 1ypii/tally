<?php

namespace App;

use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Contracts\Cache\ItemInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

final class Rates
{
    public function __construct(
        private HttpClientInterface $http,
        private CacheInterface $cache,
    ) {
    }

    public function usdRates(): ?array
    {
        $rates = $this->cache->get('usd_rates', function (ItemInterface $item) {
            $item->expiresAfter(43200);

            try {
                $res = $this->http->request('GET', 'https://open.er-api.com/v6/latest/USD', ['timeout' => 6, 'max_redirects' => 0]);
                $data = $res->toArray();
            } catch (\Throwable) {
                $item->expiresAfter(300);
                return null;
            }

            if (($data['result'] ?? '') !== 'success' || !is_array($data['rates'] ?? null)) {
                $item->expiresAfter(300);
                return null;
            }

            $rates = [];
            foreach ($data['rates'] as $code => $rate) {
                if (is_string($code) && preg_match('/^[A-Z]{3}$/', $code) && (is_float($rate) || is_int($rate)) && $rate > 0) {
                    $rates[strtolower($code)] = (float) $rate;
                }
            }

            return ['rates' => $rates, 'updated' => (int) ($data['time_last_update_unix'] ?? time())];
        });

        return $rates;
    }
}
