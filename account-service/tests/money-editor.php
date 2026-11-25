<?php
declare(strict_types=1);
function naCatalogDate($v): ?string {
    if(!is_string($v)||!preg_match('/^\d{4}-\d{2}-\d{2}$/D',$v))return null;
    [$y,$m,$d]=array_map('intval',explode('-',$v));return checkdate($m,$d,$y)?$v:null;
}
require __DIR__.'/../private/money-editor-live.php';
function verify(bool $v): void {if(!$v)throw new RuntimeException('MONEY_EDITOR_TEST');}
$root=dirname(__DIR__,2);$count=0;
foreach(meIds() as $id)for($m=1;$m<=12;$m++)for($d=1;$d<=31;$d++){
    if(!checkdate($m,$d,2000))continue;
    $s=meSource($id,sprintf('2000-%02d-%02d',$m,$d),$root);
    $p=json_decode(meMessages($s)[1]['content'],true,32,JSON_THROW_ON_ERROR);
    verify($s['key']===$d.'-'.$m&&$p['авторская_трактовка']===$s['source']&&count($p['доступные_вопросы_других_разделов'])===4);
    $count++;
}
verify($count===3660);
verify(meParse('redflag_question','redflag:money:comic-verdict-money:2000-09-09')===null);
verify(meParse('redflag_question','redflag:money:gift:2000-09-09')===null);
verify(meParse('redflag_question','redflag:money:provider:2000-02-29')===['provider','2000-02-29']);
verify(meParse('redflag_question','redflag:family:care:2000-09-09')===null);
$q=meFollowups('provider')[0];
$t=trim(str_repeat('Он может заботиться о доме и семье. ',25))."\n\nЗагляни в «".$q['category'].'» и открой «'.$q['title'].'»';
verify(meValidate($t,'stop','provider')===$t);
echo "MONEY_EDITOR 3660 source mappings, zero provider calls\n";
