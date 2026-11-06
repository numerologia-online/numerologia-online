<?php
declare(strict_types=1);
require __DIR__.'/../private/core.php';require __DIR__.'/../private/fulfillment.php';
$root=$argv[1];$fixtures=json_decode(file_get_contents($argv[2]),true,32,JSON_THROW_ON_ERROR);$checks=0;
foreach($fixtures as$f){
 $matrix=naMatrix($f['date']);if($matrix!=$f['matrix'])throw new RuntimeException('Matrix mismatch '.$f['date']);$checks++;
 $life=naMaterialBuild('life_full','life:'.$f['date'],$root);
 foreach($f['life']as$i=>$topic){$d=naMaterialJson('knowledge/full-report/sections/energy-'.$topic['energy'].'.json',$root);$expected=naMaterialParagraphs($d['sections'][$topic['key']]);if($life['sections'][$i]['paragraphs']!==$expected)throw new RuntimeException('Life selection mismatch');$checks++;}
 $pair=naMaterialBuild('compatibility_full','pair:'.$f['date'].':'.$f['partner'],$root);
 foreach($f['compatibility']as$i=>$topic){$d=naMaterialJson('data/compatibility/deep/energy-'.$topic['energy'].'.json',$root);$expected=naMaterialParagraphs($d['blocks'][$topic['key']]);if($pair['sections'][$i]['paragraphs']!==$expected)throw new RuntimeException('Compatibility selection mismatch '.$topic['key']);$checks++;}
}
foreach(['man'=>20,'love'=>15,'work'=>15,'money'=>15,'choice'=>15,'future'=>10,'home'=>10]as$category=>$limit)for($i=1;$i<=$limit;$i++)foreach(['00:00','12:34','23:59']as$clock){$q='yn-'.$category.'-'.str_pad((string)$i,3,'0',STR_PAD_LEFT);$doc=naMaterialBuild('yesno_question','yesno:'.$q.':'.$clock,$root);if(count($doc['sections'])!==1||count($doc['sections'][0]['paragraphs'])!==1)throw new RuntimeException('Question scope mismatch');$checks++;}
echo "PASS $checks canonical engine and exact-question checks\n";
