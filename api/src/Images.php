<?php

namespace App;

final class Images
{
    private const maxPixels = 4000;

    public static function reencode(string $bytes, int $maxSide, bool $keepAlpha): ?array
    {
        $info = @getimagesizefromstring($bytes);
        if (!$info || !in_array($info[2], [IMAGETYPE_PNG, IMAGETYPE_JPEG, IMAGETYPE_WEBP], true)) {
            return null;
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] > self::maxPixels || $info[1] > self::maxPixels) {
            return null;
        }

        $src = @imagecreatefromstring($bytes);
        if (!$src) {
            return null;
        }

        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, $maxSide / max($w, $h));
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));

        $dst = imagecreatetruecolor($nw, $nh);
        if ($keepAlpha) {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
            imagefill($dst, 0, 0, imagecolorallocatealpha($dst, 0, 0, 0, 127));
        } else {
            imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
        }
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        ob_start();
        if ($keepAlpha) {
            imagepng($dst, null, 7);
            $mime = 'image/png';
        } else {
            imagejpeg($dst, null, 85);
            $mime = 'image/jpeg';
        }
        $out = (string) ob_get_clean();

        return ['mime' => $mime, 'data' => $out];
    }

    public static function isPdf(string $bytes): bool
    {
        return str_starts_with($bytes, '%PDF-') && str_contains(substr($bytes, -2048), '%%EOF');
    }
}
