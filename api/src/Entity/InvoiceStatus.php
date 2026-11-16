<?php

namespace App\Entity;

enum InvoiceStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Paid = 'paid';
    case Accepted = 'accepted';
    case Declined = 'declined';
}
