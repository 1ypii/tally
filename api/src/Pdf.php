<?php

namespace App;

use App\Entity\Invoice;
use App\Entity\InvoiceStatus;
use Dompdf\Dompdf;
use Dompdf\Options;

final class Pdf
{
    public static function render(Invoice $inv): string
    {
        $options = new Options();
        $options->setIsRemoteEnabled(false);
        $options->setIsPhpEnabled(false);
        $options->setIsJavascriptEnabled(false);
        $options->setDefaultFont('DejaVu Sans');
        $options->setChroot([sys_get_temp_dir()]);

        $pdf = new Dompdf($options);
        $pdf->loadHtml(self::html($inv), 'UTF-8');
        $pdf->setPaper('A4');
        $pdf->render();

        return (string) $pdf->output();
    }

    public static function filename(Invoice $inv): string
    {
        return preg_replace('/[^A-Za-z0-9\-_.]/', '-', $inv->number()).'.pdf';
    }

    private static function e(?string $value): string
    {
        return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function money(int $minor, string $currency): string
    {
        if ($currency === 'rbx') {
            return 'R$ '.number_format($minor);
        }

        $fmt = new \NumberFormatter('en_US', \NumberFormatter::CURRENCY);
        $digits = (new \NumberFormatter('en_US@currency='.strtoupper($currency), \NumberFormatter::CURRENCY))->getAttribute(\NumberFormatter::MAX_FRACTION_DIGITS);

        return (string) $fmt->formatCurrency($minor / (10 ** $digits), strtoupper($currency));
    }

    private static function day(\DateTimeInterface $date): string
    {
        return strtolower($date->format('M j, Y'));
    }

    private static function html(Invoice $inv): string
    {
        $quote = $inv->isQuote();
        $cur = $inv->getCurrency();
        $client = $inv->getClient();
        $owner = $inv->getOwner();
        $sender = $inv->showsSender() ? $owner->profile() : null;

        $logo = '';
        if ($inv->logoVisible()) {
            $upload = $owner->getLogo();
            $logo = '<img class="logo" src="data:'.self::e($upload->getMime()).';base64,'.base64_encode($upload->bytes()).'">';
        }

        $rows = '';
        foreach ($inv->getLines() as $line) {
            $rows .= '<tr><td>'.self::e($line->getDescription()).'</td>'
                .'<td class="r">'.($line->isFixed() ? 'fixed' : self::e((string) ($line->getQuantity() / 100))).'</td>'
                .'<td class="r">'.($line->isFixed() ? '' : self::e(self::money($line->getUnitPrice(), $cur))).'</td>'
                .'<td class="r">'.self::e(self::money($line->amount(), $cur)).'</td></tr>';
        }

        $sums = '';
        if ($inv->discount() > 0 || $inv->getTaxRate() > 0) {
            $sums .= '<tr class="soft"><td>subtotal</td><td class="r">'.self::e(self::money($inv->subtotal(), $cur)).'</td></tr>';
            if ($inv->discount() > 0) {
                $sums .= '<tr class="soft"><td>discount</td><td class="r">-'.self::e(self::money($inv->discount(), $cur)).'</td></tr>';
            }
            if ($inv->getTaxRate() > 0) {
                $sums .= '<tr class="soft"><td>'.self::e(($inv->getTaxLabel() ?: 'tax').' '.($inv->getTaxRate() / 100).'%').'</td><td class="r">'.self::e(self::money($inv->tax(), $cur)).'</td></tr>';
            }
        }
        if (!$quote && $inv->paid() > 0) {
            $sums .= '<tr class="soft"><td>total</td><td class="r">'.self::e(self::money($inv->total(), $cur)).'</td></tr>';
            $sums .= '<tr class="soft"><td>paid</td><td class="r">'.self::e(self::money($inv->paid(), $cur)).'</td></tr>';
        }
        $label = $quote ? 'total' : ($inv->paid() > 0 ? 'balance due' : 'total due');
        $amount = $quote ? $inv->total() : ($inv->paid() > 0 ? $inv->balance() : $inv->total());
        $sums .= '<tr class="big"><td>'.$label.'</td><td class="r">'.self::e(self::money($amount, $cur)).'</td></tr>';

        $meta = '<tr><td class="soft">issued</td><td>'.self::day($inv->getIssuedOn()).'</td></tr>'
            .'<tr><td class="soft">'.($quote ? 'valid until' : 'due').'</td><td>'.self::day($inv->getDueOn()).'</td></tr>';
        if ($inv->getPaidAt()) {
            $meta .= '<tr><td class="soft">paid</td><td>'.self::day($inv->getPaidAt()).'</td></tr>';
        }

        $bill = '<div class="label">'.($quote ? 'prepared for' : 'billed to').'</div><b>'.self::e($client->getName()).'</b>';
        foreach ([$client->getLocation(), $client->getWebsite(), $client->getEmail(), $client->getPhone()] as $v) {
            if ($v) {
                $bill .= '<div>'.nl2br(self::e($v)).'</div>';
            }
        }
        if ($client->getTaxId()) {
            $bill .= '<div class="soft">tax id '.self::e($client->getTaxId()).'</div>';
        }

        $from = '';
        if ($sender && ($sender['businessName'] || $sender['location'] || $sender['contactEmail'])) {
            $from = '<div class="label">from</div><b>'.self::e($sender['businessName']).'</b>';
            foreach ([$sender['location'], $sender['contactEmail'], $sender['website']] as $v) {
                if ($v) {
                    $from .= '<div>'.nl2br(self::e($v)).'</div>';
                }
            }
            if ($sender['taxId']) {
                $from .= '<div class="soft">tax id '.self::e($sender['taxId']).'</div>';
            }
        }

        $pay = '';
        if (!$quote && $inv->getStatus() !== InvoiceStatus::Paid && (($sender['paymentDetails'] ?? null) || $owner->getPayLink())) {
            $pay = '<div class="box"><div class="label">how to pay</div>'.nl2br(self::e($sender['paymentDetails'] ?? ''));
            if ($owner->getPayLink()) {
                $pay .= '<div>'.self::e($owner->getPayLink()).'</div>';
            }
            $pay .= '</div>';
        }

        $notes = $inv->getNotes() ? '<div class="box notes"><div class="label">notes</div>'.nl2br(self::e($inv->getNotes())).'</div>' : '';
        $title = $quote ? 'quote' : 'invoice';
        $number = self::e($inv->number());

        return <<<HTML
<!doctype html>
<html><head><meta charset="utf-8"><style>
@page { margin: 40px 44px; }
body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5px; color: #1b1b1f; }
.soft, .label { color: #75757d; }
.label { font-size: 9px; margin-bottom: 3px; }
.top { width: 100%; border-bottom: 1px solid #e6e6e6; padding-bottom: 16px; }
.title { font-size: 26px; font-weight: bold; }
.logo { max-height: 56px; max-width: 160px; margin-bottom: 8px; }
.meta td { padding: 1px 0 1px 14px; }
.parties { width: 100%; margin: 20px 0; }
.parties td { vertical-align: top; width: 50%; }
table.lines { width: 100%; border-collapse: collapse; }
.lines th { text-align: left; font-weight: normal; color: #75757d; font-size: 9px; border-bottom: 1px solid #e6e6e6; padding: 7px 0; }
.lines td { padding: 9px 0; border-bottom: 1px solid #f0f0f0; }
.r, .lines th.r { text-align: right; }
.sums { margin-left: auto; margin-top: 14px; border-collapse: collapse; }
.sums td { padding: 3px 0 3px 30px; }
.sums .big td { font-size: 17px; font-weight: bold; padding-top: 8px; }
.box { margin-top: 22px; padding: 12px; border: 1px solid #e6e6e6; border-radius: 6px; }
.notes { background: #f7f7f6; border: 0; }
</style></head><body>
<table class="top"><tr>
<td>{$logo}<div class="title">{$title}</div><div class="soft">{$number}</div></td>
<td class="r" style="vertical-align: top"><table class="meta" style="margin-left: auto">{$meta}</table></td>
</tr></table>
<table class="parties"><tr><td>{$bill}</td><td>{$from}</td></tr></table>
<table class="lines"><thead><tr><th>description</th><th class="r">hours</th><th class="r">rate</th><th class="r">amount</th></tr></thead><tbody>{$rows}</tbody></table>
<table class="sums">{$sums}</table>
{$pay}
{$notes}
</body></html>
HTML;
    }
}
