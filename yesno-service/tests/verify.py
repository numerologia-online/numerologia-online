import pathlib,json,subprocess,tempfile,shutil,re,sys
root=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((root/'yn-man-001.json').read_text())
assert set(data['answers'])==set(map(str,range(1,10)))
assert all(re.fullmatch(r'[А-Яа-яЁё .,]+',s) for s in data['answers'].values())
assert not any(s in (root/'public/yes-no.js').read_text() for s in data['answers'].values())
php=sys.argv[1] if len(sys.argv)>1 else 'php'
with tempfile.TemporaryDirectory() as tmp:
 t=pathlib.Path(tmp);api=t/'www/site/api';api.mkdir(parents=True);private=t/'private/numi-yesno-v1/answers/man';private.mkdir(parents=True)
 shutil.copy(root/'public/numi-yesno-answer.php',api/'answer.php');shutil.copy(root/'yn-man-001.json',private/'yn-man-001.json')
 def call(time,q='yn-man-001'):
  code='$_SERVER["REQUEST_METHOD"]="GET";$_GET=json_decode('+json.dumps(json.dumps({'time':time,'question':q}))+',true);include '+json.dumps(str(api/'answer.php'))+';'
  return json.loads(subprocess.check_output([php,'-r',code]))
 for number in range(1,10):assert call('00:0'+str(number))['answer']==data['answers'][str(number)]
 assert call('14:31')['answer']==data['answers']['9']
 assert call('23:59')['answer']==data['answers']['1']
 assert call('00:00')['error']=='ZERO_TIME_UNDEFINED'
 for time in ['24:00','12:60','abc','1:20']:assert call(time)['error']=='INVALID_TIME'
 assert call('12:30','../../etc/passwd')['error']=='ANSWER_NOT_READY'
 assert call('12:30','yn-man-002')['error']=='ANSWER_NOT_READY'
print('Verified nine approved answers, digit reduction, zero time, invalid input, path allowlist, and no answer texts in JS')
