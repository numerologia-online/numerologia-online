// Тот же порядок 28 узлов, что использует pro/pro.js.
// Значения всегда читаются из calculateMatrix: учебник не содержит второй версии формул.
const equation = (values, result) => {
  const sum = values.reduce((a,b) => a + b, 0);
  return values.join(" + ") + " = " + sum + (sum === result ? "" : " → " + result);
};
const yearDigits = (year) => String(year).split("").map(Number);
const point = (id, title, group, get, explanation) =>
  ({ id, title, group, get, work: (matrix,birth) => explanation(matrix,birth) });

export const pointCatalog = [
  point("top","Месяц рождения","Опорные",m=>m.top,(m,b)=>"Месяц: "+b.month+" → "+m.top),
  point("right","Год рождения","Опорные",m=>m.right,(m,b)=>equation(yearDigits(b.year),m.right)),
  point("bottom","Нижняя опора","Опорные",m=>m.bottom,m=>equation([m.left,m.top,m.right],m.bottom)),
  point("left","День рождения","Опорные",m=>m.left,(m,b)=>"День: "+b.day+(b.day===m.left?"":" → "+m.left)),
  point("topLeft","Верхний левый угол","Углы",m=>m.corners.topLeft,m=>equation([m.left,m.top],m.corners.topLeft)),
  point("topRight","Верхний правый угол","Углы",m=>m.corners.topRight,m=>equation([m.top,m.right],m.corners.topRight)),
  point("bottomRight","Нижний правый угол","Углы",m=>m.corners.bottomRight,m=>equation([m.right,m.bottom],m.corners.bottomRight)),
  point("bottomLeft","Нижний левый угол","Углы",m=>m.corners.bottomLeft,m=>equation([m.bottom,m.left],m.corners.bottomLeft)),
  point("topOuter","Верхняя ось / внешняя","Внутренние",m=>m.topSpoke.outer,m=>equation([m.top,m.topSpoke.near],m.topSpoke.outer)),
  point("topNear","Верхняя ось / средняя","Внутренние",m=>m.topSpoke.near,m=>equation([m.top,m.center],m.topSpoke.near)),
  point("topCore","Верхняя ось / ближе к центру","Внутренние",m=>m.topSpoke.core,m=>equation([m.topSpoke.near,m.center],m.topSpoke.core)),
  point("leftOuter","Левая ось / внешняя","Внутренние",m=>m.leftSpoke.outer,m=>equation([m.left,m.leftSpoke.near],m.leftSpoke.outer)),
  point("leftNear","Левая ось / средняя","Внутренние",m=>m.leftSpoke.near,m=>equation([m.left,m.center],m.leftSpoke.near)),
  point("leftCore","Левая ось / ближе к центру","Внутренние",m=>m.leftSpoke.core,m=>equation([m.leftSpoke.near,m.center],m.leftSpoke.core)),
  point("rightOuter","Правая ось / внешняя","Внутренние",m=>m.rightSpoke.outer,m=>equation([m.right,m.rightSpoke.near],m.rightSpoke.outer)),
  point("rightNear","Правая ось / средняя","Внутренние",m=>m.rightSpoke.near,m=>equation([m.right,m.center],m.rightSpoke.near)),
  point("rightCore","Внутренний узел справа от центра","Внутренние",m=>m.rightSpoke.core,m=>equation([m.rightSpoke.near,m.center],m.rightSpoke.core)),
  point("tailFirst","Нижняя линия / первая","Кармический хвост",m=>m.tail.first,m=>equation([m.center,m.bottom],m.tail.first)),
  point("tailSecond","Нижняя линия / вторая","Кармический хвост",m=>m.tail.second,m=>equation([m.bottom,m.tail.first],m.tail.second)),
  point("topLeftOuter","Диагональ слева сверху / внешняя","Диагонали",m=>m.diagonals.topLeft.outer,m=>equation([m.corners.topLeft,m.diagonals.topLeft.near],m.diagonals.topLeft.outer)),
  point("topLeftNear","Диагональ слева сверху / внутренняя","Диагонали",m=>m.diagonals.topLeft.near,m=>equation([m.corners.topLeft,m.center],m.diagonals.topLeft.near)),
  point("topRightOuter","Диагональ справа сверху / внешняя","Диагонали",m=>m.diagonals.topRight.outer,m=>equation([m.corners.topRight,m.diagonals.topRight.near],m.diagonals.topRight.outer)),
  point("topRightNear","Диагональ справа сверху / внутренняя","Диагонали",m=>m.diagonals.topRight.near,m=>equation([m.corners.topRight,m.center],m.diagonals.topRight.near)),
  point("bottomRightOuter","Диагональ справа снизу / внешняя","Диагонали",m=>m.diagonals.bottomRight.outer,m=>equation([m.corners.bottomRight,m.diagonals.bottomRight.near],m.diagonals.bottomRight.outer)),
  point("bottomRightNear","Диагональ справа снизу / внутренняя","Диагонали",m=>m.diagonals.bottomRight.near,m=>equation([m.corners.bottomRight,m.center],m.diagonals.bottomRight.near)),
  point("bottomLeftOuter","Диагональ слева снизу / внешняя","Диагонали",m=>m.diagonals.bottomLeft.outer,m=>equation([m.corners.bottomLeft,m.diagonals.bottomLeft.near],m.diagonals.bottomLeft.outer)),
  point("bottomLeftNear","Диагональ слева снизу / внутренняя","Диагонали",m=>m.diagonals.bottomLeft.near,m=>equation([m.corners.bottomLeft,m.center],m.diagonals.bottomLeft.near)),
  point("center","Центр","Опорные",m=>m.center,m=>equation([m.left,m.top,m.right,m.bottom],m.center))
];
