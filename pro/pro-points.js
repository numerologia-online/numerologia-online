// Геометрия и подписи 31 точки. Энергии рассчитываются в общем ядре.
function sumDigits(number) {
  return String(number).split("").reduce((sum, digit) => sum + Number(digit), 0);
}

function expression(values, result) {
  const sum = values.reduce((a, b) => a + b, 0);
  return values.join(" + ") + " = " + sum + (sum === result ? "" : " → " + result);
}

export function nodesFor(birth, matrix) {
  const m = matrix;
  const points = [];
  const add = (key, label, x, y, value, formula, kind, topic, hint) => {
    points.push({key, label, x, y, value, formula, kind:kind || "", topic:topic || "", hint:hint || ""});
  };
  const baseHint = "Основная позиция: её значение используется для персональной расшифровки.";
  const extraHint = "Вспомогательная точка. Для полного вывода сопоставляйте её с соседними числами и основной позицией.";
  add("top","Месяц рождения",310,52,m.top,"Месяц рождения: " + birth.month,"major","",baseHint);
  add("right","Энергия года рождения",568,310,m.right,"Сумма цифр года " + birth.year + ": " + sumDigits(birth.year) + " → " + m.right,"major","",baseHint);
  add("bottom","Главный урок",310,568,m.bottom,expression([m.left,m.top,m.right],m.bottom),"major","lifeLesson",baseHint);
  add("left","День рождения / внешний образ",52,310,m.left,"День рождения: " + birth.day + " → " + m.left,"major","impression",baseHint);
  add("topLeft","Родительская тема",128,128,m.corners.topLeft,expression([m.left,m.top],m.corners.topLeft),"","parentsPain",baseHint);
  add("topRight","Женская линия рода / верхний угол",492,128,m.corners.topRight,expression([m.top,m.right],m.corners.topRight),"","",baseHint);
  add("bottomRight","Реализация и рост",492,492,m.corners.bottomRight,expression([m.right,m.bottom],m.corners.bottomRight),"","growth",baseHint);
  add("bottomLeft","Женская линия рода / нижний угол",128,492,m.corners.bottomLeft,expression([m.bottom,m.left],m.corners.bottomLeft),"","",baseHint);
  add("topOuter","Верхняя ось / внешняя точка",310,108,m.topSpoke.outer,expression([m.top,m.topSpoke.near],m.topSpoke.outer),"","",extraHint);
  add("topNear","Верхняя ось / средняя точка",310,158,m.topSpoke.near,expression([m.top,m.center],m.topSpoke.near),"","",extraHint);
  add("topCore","Верхняя ось / внутренняя точка",310,216,m.topSpoke.core,expression([m.topSpoke.near,m.center],m.topSpoke.core),"","",extraHint);
  add("leftOuter","Левая ось / внешняя точка",108,310,m.leftSpoke.outer,expression([m.left,m.leftSpoke.near],m.leftSpoke.outer),"","",extraHint);
  add("leftNear","Левая ось / средняя точка",158,310,m.leftSpoke.near,expression([m.left,m.center],m.leftSpoke.near),"","",extraHint);
  add("leftCore","Левая ось / внутренняя точка",216,310,m.leftSpoke.core,expression([m.leftSpoke.near,m.center],m.leftSpoke.core),"","",extraHint);
  add("rightOuter","Материальная карма / правый луч",512,310,m.rightSpoke.outer,expression([m.right,m.rightSpoke.near],m.rightSpoke.outer),"","moneyBlock",baseHint);
  add("rightNear","Вход в денежный канал",462,310,m.channels.moneyEntry,expression([m.right,m.center],m.channels.moneyEntry),"","moneyFlow",baseHint);
  add("rightCore","Внутренняя точка материальной оси",404,310,m.rightSpoke.core,expression([m.rightSpoke.near,m.center],m.rightSpoke.core),"","",extraHint);
  add("tailFirst","Вход в канал отношений / кармический хвост",310,462,m.channels.loveEntry,expression([m.center,m.bottom],m.channels.loveEntry),"","",baseHint);
  add("tailSecond","Кармический хвост / середина",310,512,m.tail.second,expression([m.bottom,m.tail.first],m.tail.second),"","",baseHint);
  add("loveHeart","Под сердцем / партнёр",348,424,m.channels.lovePoint,expression([m.channels.loveEntry,m.channels.balance],m.channels.lovePoint),"","partner","Точка любви на диагонали денег и отношений.");
  add("wellbeing","Баланс денег и отношений",386,386,m.channels.balance,expression([m.channels.moneyEntry,m.channels.loveEntry],m.channels.balance),"","","Общая точка любви и денег.");
  add("moneyPoint","Под долларом / профессия и доход",424,348,m.channels.moneyPoint,expression([m.channels.moneyEntry,m.channels.balance],m.channels.moneyPoint),"","earning","Точка под знаком доллара на денежном канале.");
  const diag = [
    ["topLeft",m.corners.topLeft,m.diagonals.topLeft,160,160,202,202,"Верхняя левая диагональ"],
    ["topRight",m.corners.topRight,m.diagonals.topRight,460,160,418,202,"Верхняя правая диагональ"],
    ["bottomRight",m.corners.bottomRight,m.diagonals.bottomRight,460,460,418,418,"Нижняя правая диагональ"],
    ["bottomLeft",m.corners.bottomLeft,m.diagonals.bottomLeft,160,460,202,418,"Нижняя левая диагональ"]
  ];
  diag.forEach(([key,base,part,ox,oy,nx,ny,label]) => {
    add(key + "Outer",label + " / внешняя",ox,oy,part.outer,expression([base,part.near],part.outer),"","",extraHint);
    add(key + "Near",label + " / внутренняя",nx,ny,part.near,expression([base,m.lineage.ancestralCenter],part.near),"","",extraHint);
  });
  add("center","Центральная энергия",310,310,m.center,expression([m.left,m.top,m.right,m.bottom],m.center),"center","trueSelf",baseHint);
  return points;
}


