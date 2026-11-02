import { calculateMatrix, parseBirthDate, reduce22 } from '../../numerology-core.js?v=5';
import { nodesFor } from '../pro-points.js?v=3';

export const BASIC_KEYS = ['left','top','right','bottom','center','topLeft','topRight','bottomRight','bottomLeft'];
export const AXIS_KEYS = ['topNear','topOuter','topCore','leftNear','leftOuter','leftCore','rightNear','rightOuter','rightCore'];
export const DIAGONAL_KEYS = ['topLeftNear','topLeftOuter','topRightNear','topRightOuter','bottomRightNear','bottomRightOuter','bottomLeftNear','bottomLeftOuter'];
export const CHANNEL_KEYS = ['wellbeing','loveHeart','moneyPoint'];
export const BUILD_ORDER = [...BASIC_KEYS,...AXIS_KEYS,...DIAGONAL_KEYS,'tailFirst','tailSecond',...CHANNEL_KEYS];
export const EXAMPLE_DATES = ['14.07.1990','08.09.1987','29.02.2000','31.12.1979','24.11.2001','09.09.1986'];

export const LESSON_SKILLS = {
  start: { kind:'placement', keys:BASIC_KEYS, goal:'Найти девять основных мест на пустой схеме.', outcome:'Отличаю четыре вершины ромба, четыре угла квадрата и центр.', next:'Правило приведения к 22' },
  reduce: { kind:'reduction', goal:'Оставлять 1–22 без изменений и приводить большие числа.', outcome:'Умею объяснить разницу между 22 и 23; не вычитаю 22.', next:'Пять основных чисел' },
  base: { keys:BASIC_KEYS.slice(0,5), goal:'Самостоятельно рассчитать и поставить день, месяц, год, нижнюю точку и центр.', outcome:'Получаю пять опорных значений и знаю место каждого.', next:'Четыре угла квадрата' },
  corners: { keys:BASIC_KEYS.slice(5), goal:'Добавить четыре угла из соседних вершин ромба.', outcome:'Для каждого угла выбираю правильную пару исходных точек.', next:'Три внутренние оси' },
  internal: { keys:AXIS_KEYS, goal:'Заполнить три точки каждой из трёх осей.', outcome:'Различаю среднюю, внешнюю и внутреннюю точку; считаю их в порядке зависимостей.', next:'Внутренние родовые диагонали' },
  diagonals: { keys:DIAGONAL_KEYS, goal:'Построить по две точки на каждой родовой диагонали.', outcome:'Использую основной центр, затем найденную внутреннюю точку.', next:'Нижняя линия и кармический хвост' },
  tail: { keys:['tailFirst','tailSecond','bottom'], goal:'Построить нижнюю линию и сохранить порядок хвоста.', outcome:'Записываю хвост от центра вниз: первая, вторая, нижняя точка.', next:'Точки денег и отношений' },
  channels: { keys:['rightNear','tailFirst',...CHANNEL_KEYS], goal:'Найти два входа, баланс, точку под сердцем и под долларом.', outcome:'Различаю вход в канал и отдельную точку на диагонали.', next:'Показатели предназначения' },
  purpose: { kind:'purpose', goal:'Посчитать предназначение отдельно от точек рисунка.', outcome:'Различаю основной центр, показатели рода и уровни предназначения.', next:'Самостоятельная матрица' },
  'build-independent': { keys:BUILD_ORDER, independent:true, goal:'Собрать все 31 позицию на другой дате без готовых ответов.', outcome:'Переношу способ расчёта на новую дату, а не воспроизвожу знакомый пример.', next:'Знакомство с энергиями' }
};

export function learningBirthDate(value) {
  const birth = parseBirthDate(String(value));
  if (!birth) return null;
  const now = new Date();
  if (new Date(birth.year,birth.month-1,birth.day) > new Date(now.getFullYear(),now.getMonth(),now.getDate())) return null;
  return birth;
}
const dependencies = {
  left:[], top:[], right:[], bottom:['left','top','right'], center:['left','top','right','bottom'],
  topLeft:['left','top'], topRight:['top','right'], bottomRight:['right','bottom'], bottomLeft:['bottom','left'],
  topNear:['top','center'], topOuter:['top','topNear'], topCore:['topNear','center'],
  leftNear:['left','center'], leftOuter:['left','leftNear'], leftCore:['leftNear','center'],
  rightNear:['right','center'], rightOuter:['right','rightNear'], rightCore:['rightNear','center'],
  tailFirst:['center','bottom'], tailSecond:['bottom','tailFirst'],
  wellbeing:['rightNear','tailFirst'], loveHeart:['tailFirst','wellbeing'], moneyPoint:['rightNear','wellbeing'],
  topLeftNear:['topLeft','center'], topLeftOuter:['topLeft','topLeftNear'],
  topRightNear:['topRight','center'], topRightOuter:['topRight','topRightNear'],
  bottomRightNear:['bottomRight','center'], bottomRightOuter:['bottomRight','bottomRightNear'],
  bottomLeftNear:['bottomLeft','center'], bottomLeftOuter:['bottomLeft','bottomLeftNear']
};
const positions = {
  left:'Слева, на крайней вершине ромба.',top:'Сверху, на крайней вершине ромба.',right:'Справа, на крайней вершине ромба.',bottom:'Снизу, на крайней вершине ромба.',center:'На пересечении основных осей.',
  topLeft:'Верхний левый угол прямого квадрата.',topRight:'Верхний правый угол прямого квадрата.',bottomRight:'Нижний правый угол прямого квадрата.',bottomLeft:'Нижний левый угол прямого квадрата.',
  topNear:'Середина верхнего луча.',topOuter:'На верхнем луче, между вершиной и средней точкой.',topCore:'На верхнем луче, между средней точкой и центром.',
  leftNear:'Середина левого луча.',leftOuter:'На левом луче ближе к краю.',leftCore:'На левом луче ближе к центру.',
  rightNear:'Середина правого луча; это же вход в деньги.',rightOuter:'На правом луче ближе к краю.',rightCore:'На правом луче ближе к центру.',
  tailFirst:'Нижний луч, первая внутренняя точка от центра.',tailSecond:'Нижний луч, между первой точкой и нижней вершиной.',
  wellbeing:'Середина наклонной линии между двумя входами.',loveHeart:'На наклонной линии ближе к нижнему входу; под сердцем.',moneyPoint:'На наклонной линии ближе к правому входу; под долларом.'
};
const names = { left:'День рождения',top:'Месяц рождения',right:'Энергия года рождения',bottom:'Нижняя точка',center:'Основной центр',topLeft:'Верхний левый угол',topRight:'Верхний правый угол',bottomRight:'Нижний правый угол',bottomLeft:'Нижний левый угол',rightNear:'Средняя точка правой оси / вход в деньги',tailFirst:'Первая нижняя точка / вход в отношения',wellbeing:'Баланс денег и отношений',loveHeart:'Точка под сердцем',moneyPoint:'Точка под долларом' };

export function reductionTrace(value) {
  let current=value; const steps=[String(value)];
  while (current>22) { const digits=String(current).split('').map(Number);current=digits.reduce((a,b)=>a+b,0);steps.push(digits.join(' + ')+' = '+current); }
  return steps.join(' → ');
}
export function constructionSteps(birth, matrix=calculateMatrix(birth)) {
  const nodes=nodesFor(birth,matrix), map=new Map(nodes.map(n=>[n.key,n]));
  return BUILD_ORDER.map((key,index)=>{
    const node=map.get(key), deps=dependencies[key];
    if (!node || !deps) throw new Error('Не описана точка '+key);
    const values=key==='left'?[birth.day]:key==='top'?[birth.month]:key==='right'?String(birth.year).split('').map(Number):deps.map(k=>map.get(k).value);
    const raw=values.reduce((a,b)=>a+b,0);
    const expression=(values.length>1?values.join(' + ')+' = ':'')+reductionTrace(raw);
    const group=BASIC_KEYS.includes(key)?'Основа и углы':AXIS_KEYS.includes(key)?'Внутренние оси':DIAGONAL_KEYS.includes(key)?'Родовые диагонали':['tailFirst','tailSecond'].includes(key)?'Нижняя линия':'Деньги и отношения';
    return {...node,id:key,number:index+1,title:names[key]||node.label,group,dependencies:deps,operands:values,raw,expression,value:node.value,position:positions[key]||node.label.replace(' / ',' — '),rule:key==='left'?'Берём число дня и применяем правило 22.':key==='top'?'Берём номер месяца без изменения.':key==='right'?'Складываем все цифры года, затем применяем правило 22.':'Складываем уже рассчитанные значения: '+deps.map(k=>names[k]||map.get(k).label).join(' + ')+'. Если сумма больше 22, складываем её цифры до диапазона 1–22.'};
  });
}
export function purposeSteps(matrix) {
  const m=matrix, make=(id,title,values,value,rule)=>({id,title,operands:values,raw:values.reduce((a,b)=>a+b,0),value,expression:values.join(' + ')+' = '+reductionTrace(values.reduce((a,b)=>a+b,0)),rule,group:'Отдельные показатели',dependencies:[]});
  return [
    make('sky','Небо',[m.top,m.bottom],m.purpose.sky,'Верхняя + нижняя точка.'),
    make('earth','Земля',[m.left,m.right],m.purpose.earth,'Левая + правая точка.'),
    make('personal','Личное предназначение',[m.purpose.sky,m.purpose.earth],m.purpose.personal,'Небо + земля.'),
    make('male','Мужская линия',[m.corners.topLeft,m.corners.bottomRight],m.lineage.male,'Верхний левый + нижний правый угол.'),
    make('female','Женская линия',[m.corners.topRight,m.corners.bottomLeft],m.lineage.female,'Верхний правый + нижний левый угол.'),
    make('social','Социальное предназначение',[m.lineage.male,m.lineage.female],m.purpose.social,'Мужская + женская линия.'),
    make('general','Общее / духовное предназначение',[m.purpose.personal,m.purpose.social],m.purpose.general,'Личное + социальное предназначение.'),
    make('planetary','Планетарное предназначение',[m.purpose.social,m.purpose.general],m.purpose.planetary,'Дополнительный показатель: социальное + общее.'),
    make('ancestralCenter','Показатель силы рода',[m.corners.topLeft,m.corners.topRight,m.corners.bottomRight,m.corners.bottomLeft],m.lineage.ancestralCenter,'Сумма четырёх углов. Не заменяет основной центр.'),
    make('overallCenter','Общий показатель центров',[m.center,m.lineage.ancestralCenter],m.lineage.overallCenter,'Основной центр + показатель силы рода. Отдельное вычисление, не новая точка рисунка.')
  ];
}
export function reductionTasks() { return [11,22,23,29,31,33,44,59,99,1990].map(raw=>({id:'reduce-'+raw,title:'Приведите '+raw+' к диапазону 1–22',raw,value:reduce22(raw),operands:[raw],expression:reductionTrace(raw),rule:'Числа 1–22 сохраняем. Для числа больше 22 складываем его цифры; при необходимости повторяем.',dependencies:[],group:'Правило 22'})); }

const PROGRESS_KEY='numerologia-online-pro-school-v1';
export function readLearningProgress() {
  const completed=new Set();
  for(const storage of ['localStorage','sessionStorage'])try{const value=JSON.parse(window[storage].getItem(PROGRESS_KEY)||'[]');if(Array.isArray(value))value.filter(x=>typeof x==='string').forEach(id=>completed.add(id));}catch{}
  return completed;
}
export function markLearningLesson(id) {
  const done=readLearningProgress();done.add(id);for(const storage of ['localStorage','sessionStorage'])try{window[storage].setItem(PROGRESS_KEY,JSON.stringify([...done]));return storage;}catch{}
  return null;
}
