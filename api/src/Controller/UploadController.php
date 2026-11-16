<?php

namespace App\Controller;

use App\Entity\Expense;
use App\Entity\Upload;
use App\Entity\User;
use App\Images;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api')]
final class UploadController extends AbstractController
{
    private const maxFile = 5_000_000;
    private const maxTotal = 50_000_000;

    public function __construct(private EntityManagerInterface $em)
    {
    }

    #[Route('/logo', methods: ['POST'])]
    public function uploadLogo(#[CurrentUser] User $user, Request $request): JsonResponse
    {
        $bytes = $this->read($request);
        if (is_string($bytes) === false) {
            return $bytes;
        }

        $image = Images::reencode($bytes, 512, true);
        if (!$image) {
            return $this->json(['error' => 'use a png, jpg or webp image up to 4000 pixels wide'], 422);
        }
        if (!$this->roomFor($user, strlen($image['data']))) {
            return $this->json(['error' => 'you are out of upload space, remove some receipts first'], 422);
        }

        $old = $user->getLogo();
        $logo = new Upload($user, 'logo', $image['mime'], $image['data']);
        $this->em->persist($logo);
        $user->setLogo($logo);
        if ($old) {
            $this->em->remove($old);
        }
        $this->em->flush();

        return $this->json(['hasLogo' => true]);
    }

    #[Route('/logo', methods: ['DELETE'])]
    public function deleteLogo(#[CurrentUser] User $user): JsonResponse
    {
        $old = $user->getLogo();
        if ($old) {
            $user->setLogo(null);
            $this->em->remove($old);
            $this->em->flush();
        }

        return $this->json(['hasLogo' => false]);
    }

    #[Route('/logo', methods: ['GET'])]
    public function showLogo(#[CurrentUser] User $user): Response
    {
        $logo = $user->getLogo() ?? throw $this->createNotFoundException();

        return self::serve($logo, false);
    }

    #[Route('/expenses/{id}/receipt', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function uploadReceipt(#[CurrentUser] User $user, int $id, Request $request): JsonResponse
    {
        $expense = $this->expense($user, $id);
        $bytes = $this->read($request);
        if (is_string($bytes) === false) {
            return $bytes;
        }

        if (Images::isPdf($bytes)) {
            $file = ['mime' => 'application/pdf', 'data' => $bytes];
        } else {
            $file = Images::reencode($bytes, 2000, false);
            if (!$file) {
                return $this->json(['error' => 'use a pdf, png, jpg or webp file'], 422);
            }
        }

        $old = $expense->getReceipt();
        if (!$this->roomFor($user, strlen($file['data']) - ($old?->getSize() ?? 0))) {
            return $this->json(['error' => 'you are out of upload space, 50 mb per account'], 422);
        }

        $receipt = new Upload($user, 'receipt', $file['mime'], $file['data']);
        $this->em->persist($receipt);
        $expense->setReceipt($receipt);
        if ($old) {
            $this->em->remove($old);
        }
        $this->em->flush();

        return $this->json($expense->toJson());
    }

    #[Route('/expenses/{id}/receipt', requirements: ['id' => '\d+'], methods: ['GET'])]
    public function showReceipt(#[CurrentUser] User $user, int $id): Response
    {
        $receipt = $this->expense($user, $id)->getReceipt() ?? throw $this->createNotFoundException();

        return self::serve($receipt, $receipt->getMime() === 'application/pdf');
    }

    #[Route('/expenses/{id}/receipt', requirements: ['id' => '\d+'], methods: ['DELETE'])]
    public function deleteReceipt(#[CurrentUser] User $user, int $id): JsonResponse
    {
        $expense = $this->expense($user, $id);
        $old = $expense->getReceipt();
        if ($old) {
            $expense->setReceipt(null);
            $this->em->remove($old);
            $this->em->flush();
        }

        return $this->json($expense->toJson());
    }

    public static function serve(Upload $upload, bool $download): Response
    {
        $res = new Response($upload->bytes());
        $res->headers->set('Content-Type', $upload->getMime());
        $res->headers->set('Content-Disposition', $download ? 'attachment; filename="receipt.pdf"' : 'inline');
        $res->headers->set('Content-Security-Policy', "default-src 'none'; sandbox");
        $res->headers->set('Cache-Control', 'private, no-cache');

        return $res;
    }

    private function read(Request $request): string|JsonResponse
    {
        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            return $this->json(['error' => 'no file came through, try again'], 422);
        }
        if ($file->getSize() > self::maxFile) {
            return $this->json(['error' => 'files can be up to 5 mb'], 422);
        }

        return (string) file_get_contents($file->getPathname());
    }

    private function roomFor(User $user, int $bytes): bool
    {
        $used = (int) $this->em->createQuery('SELECT COALESCE(SUM(u.size), 0) FROM '.Upload::class.' u WHERE u.owner = :owner')
            ->setParameter('owner', $user)
            ->getSingleScalarResult();

        return $used + $bytes <= self::maxTotal;
    }

    private function expense(User $user, int $id): Expense
    {
        return $this->em->getRepository(Expense::class)->findOneBy(['id' => $id, 'owner' => $user]) ?? throw $this->createNotFoundException();
    }
}
