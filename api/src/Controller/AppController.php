<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class AppController extends AbstractController
{
    #[Route('/{path}', requirements: ['path' => '(?!api(/|$)).*'], defaults: ['path' => ''], methods: ['GET'], priority: -100)]
    public function __invoke(string $path): Response
    {
        $file = $this->getParameter('kernel.project_dir').'/public/index.html';
        if (!is_file($file)) {
            throw $this->createNotFoundException();
        }

        $res = new BinaryFileResponse($file);
        $res->headers->set('Content-Type', 'text/html; charset=utf-8');
        $res->headers->set('Cache-Control', 'no-cache');
        $res->headers->set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://icons.duckduckgo.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

        if (str_starts_with($path, 'i/')) {
            $res->headers->set('X-Robots-Tag', 'noindex, nofollow');
        }

        return $res;
    }
}
