<?php

namespace App\EventSubscriber;

use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;
use Symfony\Component\RateLimiter\RateLimiterFactoryInterface;

final class ApiGuard implements EventSubscriberInterface
{
    public function __construct(
        private Security $security,
        private RateLimiterFactoryInterface $signupLimiter,
        private RateLimiterFactoryInterface $writesLimiter,
    ) {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            KernelEvents::REQUEST => [['checkOrigin', 16], ['limit', 0]],
            KernelEvents::RESPONSE => 'headers',
        ];
    }

    public function checkOrigin(RequestEvent $event): void
    {
        $req = $event->getRequest();
        if (!$this->isApiWrite($event)) {
            return;
        }

        $origin = $req->headers->get('Origin');
        $site = $req->headers->get('Sec-Fetch-Site');

        if ($origin !== null) {
            $ok = $origin === $req->getSchemeAndHttpHost();
        } else {
            $ok = $site === null || $site === 'same-origin';
        }

        if (!$ok) {
            $event->setResponse(new JsonResponse(['error' => 'cross site request blocked'], 403));
        }
    }

    public function limit(RequestEvent $event): void
    {
        $req = $event->getRequest();
        if (!$this->isApiWrite($event)) {
            return;
        }

        $path = $req->getPathInfo();
        if ($path === '/api/login') {
            return;
        }

        if ($path === '/api/register' || $path === '/api/demo') {
            $limiter = $this->signupLimiter->create($req->getClientIp() ?? 'unknown');
        } else {
            $user = $this->security->getUser();
            $limiter = $this->writesLimiter->create($user ? 'u'.$user->getUserIdentifier() : 'ip'.$req->getClientIp());
        }

        $limit = $limiter->consume();
        if ($limit->isAccepted()) {
            return;
        }

        $res = new JsonResponse(['error' => 'too many requests, try again later'], 429);
        $res->headers->set('Retry-After', (string) max(1, $limit->getRetryAfter()->getTimestamp() - time()));
        $event->setResponse($res);
    }

    public function headers(ResponseEvent $event): void
    {
        $headers = $event->getResponse()->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('Referrer-Policy', 'same-origin');
        $headers->set('X-Frame-Options', 'DENY');
    }

    private function isApiWrite(RequestEvent $event): bool
    {
        $req = $event->getRequest();

        return $event->isMainRequest()
            && !$req->isMethodSafe()
            && str_starts_with($req->getPathInfo(), '/api/');
    }
}
