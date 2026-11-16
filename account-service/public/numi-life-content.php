<?php
declare(strict_types=1);

require dirname(__DIR__, 3).'/private/numi-account-20261031/core.php';

function lifeOwner(?array $account, array $body): bool {
    if (naTestOwner($account)) return true;

    // Reuse the existing proof for the bot owner and for the school PDF.
    $signed = $body['init_data'] ?? '';
    $signed = is_string($signed) ? $signed : '';
    if ($account || $signed !== '' || !empty($_COOKIE['__Host-numi_school_owner'])) {
        try {
            $private = dirname(__DIR__, 3).'/private';
            require_once $private.'/numi-content-reg-20261031/core.php';
            require_once $private.'/numi-school-owner-20261103/gate.php';
            $config = numiConfig();
            $key = hash_hmac('sha256', 'numi-school-owner-v1', numiBotToken($config), true);
            if (nsOwner($config, $key, $signed) || ($signed !== '' && nsOwner($config, $key))) {
                return true;
            }
        } catch (Throwable $error) {
            error_log('NUMI_LIFE_OWNER:'.get_class($error));
        }
    }

    // The existing browser Telegram login supplies a signed, expiring ticket.
    $ticket = $body['owner_ticket'] ?? '';
    if (!is_string($ticket) || !preg_match('/^[A-Za-z0-9_.-]{16,5000}$/D', $ticket)) return false;
    $context = stream_context_create(['http'=>[
        'method'=>'GET', 'timeout'=>4, 'follow_location'=>0,
        'header'=>['Authorization: Bearer '.$ticket, 'Accept: application/json']
    ]]);
    $reply = @file_get_contents('https://numerologia-online-auth-server.vercel.app/api/session', false, $context, 0, 4096);
    if (!is_string($reply)) return false;
    $identity = json_decode($reply, true);
    return ($identity['owner'] ?? false) === true && !empty($identity['user']['id']);
}

function lifeSources(): string {
    return dirname(__DIR__, 3).'/private/numi-life-sources-20261116/';
}

function lifeSource(string $name): string {
    // All call sites select names from fixed report mappings.
    $path = lifeSources().$name;
    if (!is_file($path) || is_link($path) || filesize($path) > 2_000_000) {
        throw new RuntimeException('LIFE_SOURCE_UNAVAILABLE');
    }
    $contents = file_get_contents($path);
    if (!is_string($contents) || $contents === '') throw new RuntimeException('LIFE_SOURCE_EMPTY');
    return $contents;
}

function lifeJson(string $name): array {
    $data = json_decode(lifeSource($name), true, 64, JSON_THROW_ON_ERROR);
    if (!is_array($data)) throw new RuntimeException('LIFE_SOURCE_INVALID');
    return $data;
}

function lifeTriple(array $values): string {
    sort($values, SORT_NUMERIC);
    return implode('-', $values);
}

// Reuse the store's birth-date calculation. The diagram adds the internal
// diagonals and channel balance used by the original karmic program lookup.
function lifePositions(array $matrix): array {
    $center = $matrix['center'];
    $entry = $matrix['rightSpoke']['near'];
    $tail = [$matrix['tail']['first'], $matrix['tail']['second'], $matrix['bottom']];
    $balance = naReduce($entry + $tail[0]);
    $energies = [
        $matrix['top'], $matrix['left'], $matrix['right'], $matrix['bottom'], $center,
        ...array_values($matrix['corners']), ...$tail, $balance,
        ...array_values($matrix['channels'])
    ];
    $triples = [$tail, [$entry, $matrix['channels']['moneyPoint'], $balance],
        [$tail[0], $matrix['channels']['lovePoint'], $balance]];
    foreach (['top', 'left', 'right'] as $axis) {
        $spoke = $matrix[$axis.'Spoke'];
        $energies[] = $spoke['outer'];
        $energies[] = $spoke['near'];
        $energies[] = naReduce($spoke['near'] + $center);
        $triples[] = [$matrix[$axis], $spoke['outer'], $spoke['near']];
    }
    foreach ($matrix['corners'] as $corner) {
        $near = naReduce($corner + $center);
        $outer = naReduce($corner + $near);
        $energies[] = $near;
        $energies[] = $outer;
        $triples[] = [$corner, $outer, $near];
    }
    return [$energies, array_fill_keys(array_map('lifeTriple', $triples), true), lifeTriple($tail)];
}

function lifeKarma(array $matrix, bool $preview): array {
    [, $triples, $tailKey] = lifePositions($matrix);
    $bank = lifeJson('karmic-programs.json');
    if (($bank['schema'] ?? null) !== 'pro-karmic-programs-v2' || count($bank['entries'] ?? []) !== 72) {
        throw new RuntimeException('LIFE_KARMA_UNAVAILABLE');
    }
    $matches = static fn(string $code): bool => isset($triples[lifeTriple(explode('-', $code))]);
    $programs = array_values(array_filter($bank['entries'], static fn(array $entry): bool => $matches($entry['code'])));
    if ($preview) return ['count'=>count($programs)];

    $tails = '';
    foreach (preg_split('/^(?=## \d+-\d+-\d+ «)/m', lifeSource('karmic-tails.md')) as $chapter) {
        if (preg_match('/^## ((?:\d+-){2}\d+) «/u', $chapter, $match)
            && lifeTriple(explode('-', $match[1])) === $tailKey) {
            $tails .= $chapter;
        }
    }
    $tailGuidance = array_merge(
        lifeJson('karmic-tail-deepening-a.json')['entries'],
        lifeJson('karmic-tail-deepening-b.json')['entries']
    );
    return [
        'programs'=>$programs,
        'tails'=>$tails,
        'deepening'=>[
            'tail'=>(object)array_filter($tailGuidance, $matches, ARRAY_FILTER_USE_KEY),
            'program'=>(object)array_filter($bank['guidanceByCode'], $matches, ARRAY_FILTER_USE_KEY)
        ]
    ];
}

naHeaders();
header('X-Robots-Tag: noindex, nofollow, noarchive');
header('Vary: Cookie, Origin');

try {
    $body = naReadPost();
    $kind = $body['kind'] ?? null;
    $birth = naCatalogDate($body['birth_date'] ?? null);
    if ($kind !== 'access' && !$birth) naReply(400, ['ok'=>false, 'error'=>'INVALID_BIRTH_DATE']);

    require_once dirname(__DIR__, 3).'/private/numi-account-20261031/fulfillment.php';
    if ($kind === 'karma_preview') {
        naReply(200, lifeKarma(naMatrix($birth), true));
    }

    $db = naDB();
    $account = naCurrent($db);
    $owner = lifeOwner($account, $body);
    $purchased = !$owner && $birth && naCatalogHasAccess($db, $account, 'life_full', 'life:'.$birth);
    if ($kind === 'access') {
        naReply(200, ['ok'=>true, 'owner'=>$owner, 'purchased'=>$purchased, 'authenticated'=>$account !== null]);
    }
    if (!$owner && !$purchased) naReply(403, ['ok'=>false, 'error'=>'FULL_LIFE_ACCESS_REQUIRED']);

    $matrix = naMatrix($birth);
    if ($kind === 'karma') naReply(200, lifeKarma($matrix, false));
    if ($kind === 'purpose') {
        $purpose = $matrix['purpose'];
        $purpose['planetary'] = naReduce($purpose['social'] + $purpose['general']);
        $readings = [];
        foreach ($purpose as $scope => $number) {
            $source = lifeJson($scope.'.json');
            $reading = $source['readings'][(string)$number] ?? null;
            if (($source['scope'] ?? null) !== $scope || !is_string($reading) || trim($reading) === '') {
                throw new RuntimeException('LIFE_PURPOSE_UNAVAILABLE');
            }
            $readings[$scope] = (object)[(string)$number=>$reading];
        }
        naReply(200, $readings);
    }

    $keys = ['impression', 'trueSelf', 'growth', 'character', 'parentsPain', 'familyError',
        'trueLove', 'partner', 'moneyBlock', 'moneyFlow', 'earning', 'energyLeak', 'health', 'lifeLesson'];
    $energy = $body['energy'] ?? null;
    $chapter = $body['chapter'] ?? null;
    [$energies] = lifePositions($matrix);
    if (!in_array($kind, ['section', 'guidance'], true) || !in_array($chapter, $keys, true)
        || !is_int($energy) || !in_array($energy, $energies, true)) {
        naReply(400, ['ok'=>false, 'error'=>'INVALID_READING']);
    }
    if ($kind === 'section') {
        $bank = naMaterialJson('knowledge/full-report/sections/energy-'.$energy.'.json');
        if (($bank['id'] ?? null) !== $energy || empty($bank['sections'][$chapter]['paragraphs'])) {
            throw new RuntimeException('LIFE_CHAPTER_UNAVAILABLE');
        }
    } else {
        if (!in_array($energy, [4, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22], true)) {
            naReply(400, ['ok'=>false, 'error'=>'INVALID_GUIDANCE_ENERGY']);
        }
        $bank = lifeJson('guidance-energy-'.$energy.'.json');
        if (($bank['energy'] ?? null) !== $energy || !isset($bank['sections'][$chapter])) {
            throw new RuntimeException('LIFE_GUIDANCE_UNAVAILABLE');
        }
    }
    naReply(200, ['sections'=>[$chapter=>$bank['sections'][$chapter]]]);
} catch (Throwable $error) {
    error_log('NUMI_LIFE_SOURCE:'.get_class($error));
    naReply(503, ['ok'=>false, 'error'=>'FULL_LIFE_SOURCE_UNAVAILABLE']);
}
