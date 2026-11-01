<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET')reply(405,['ok'=>false,'error'=>'METHOD_NOT_ALLOWED']);
$q=$_GET['question']??null;$time=$_GET['time']??null;
// Explicit approved trial question allowlist. No arbitrary file paths.
if(!in_array($q,['yn-man-001','yn-man-002'],true))reply(404,['ok'=>false,'error'=>'ANSWER_NOT_READY']);
if(!is_string($time)||!preg_match('/^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/D',$time))reply(400,['ok'=>false,'error'=>'INVALID_TIME']);
$sum=array_sum(array_map('intval',str_split(str_replace(':','',$time))));
while($sum>9)$sum=array_sum(array_map('intval',str_split((string)$sum)));
$root=dirname(__DIR__,3).'/private/numi-yesno-v1';
$data=json_decode((string)@file_get_contents($root.'/answers/man/'.$q.'.json'),true);
if(!is_array($data)||($data['status']??'')!=='approved'||($data['question_id']??'')!==$q||($data['calculation_version']??'')!=='time-digit-sum-v1'||!is_string($data['answers'][(string)$sum]??null))reply(503,['ok'=>false,'error'=>'ANSWER_UNAVAILABLE']);
reply(200,['ok'=>true,'question_id'=>$q,'answer'=>$data['answers'][(string)$sum]]);

