const home = document.querySelector("#home");
const matrix = document.querySelector("#matrix");
const form = document.querySelector("#matrix-form");
const birthDateInput = document.querySelector("#matrix-birth-date");
const error = document.querySelector("#matrix-error");
const result = document.querySelector("#matrix-result");
const resultTitle = document.querySelector("#matrix-result-title");
const diagram = document.querySelector("#matrix-diagram");
const backButton = document.querySelector("#back-matrix-home");

const reduce22 = (value) => {
  let result = Math.abs(Math.trunc(value));
  while (result > 22) result = String(result).split("").reduce((sum, digit) => sum + Number(digit), 0);
  return result || 22;
};

const parseBirthDate = (value) => {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;

  const [, dayString, monthString, yearString] = match;
  const day = Number(dayString);
  const month = Number(monthString);
  const year = Number(yearString);
  const today = new Date();
  const date = new Date(year, month - 1, day);

  if (year < 1900 || year > today.getFullYear() || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { day, month, year };
};

const calculateMatrix = ({ day, month, year }) => {
  const left = reduce22(day);
  const top = month;
  const right = reduce22(String(year).split("").reduce((sum, digit) => sum + Number(digit), 0));
  const bottom = reduce22(left + top + right);
  const center = reduce22(left + top + right + bottom);
  const corners = {
    topLeft: reduce22(left + top),
    topRight: reduce22(top + right),
    bottomRight: reduce22(right + bottom),
    bottomLeft: reduce22(bottom + left)
  };
  const spoke = (base) => {
    const near = reduce22(base + center);
    return {
      outer: reduce22(base + near),
      near,
      core: reduce22(near + center)
    };
  };
  const diagonal = (corner) => {
    const near = reduce22(corner + center);
    return { outer: reduce22(corner + near), near };
  };
  const tailFirst = reduce22(center + bottom);

  return {
    top,
    right,
    bottom,
    left,
    center,
    corners,
    topSpoke: spoke(top),
    leftSpoke: spoke(left),
    rightSpoke: spoke(right),
    diagonals: {
      topLeft: diagonal(corners.topLeft),
      topRight: diagonal(corners.topRight),
      bottomRight: diagonal(corners.bottomRight),
      bottomLeft: diagonal(corners.bottomLeft)
    },
    tail: { first: tailFirst, second: reduce22(bottom + tailFirst) }
  };
};

const node = (x, y, value, type = "plain", size = "small") => `
  <g class="matrix-node matrix-node--${type} matrix-node--${size}">
    <circle cx="${x}" cy="${y}" r="${size === "major" ? 29 : size === "center" ? 34 : 18}"></circle>
    <text x="${x}" y="${y}">${value}</text>
  </g>`;

const renderMatrix = (data, formattedDate) => {
  const { corners, diagonals } = data;
  diagram.innerHTML = `
    <svg viewBox="0 0 620 620" role="img" aria-labelledby="matrix-svg-title matrix-svg-description">
      <title id="matrix-svg-title">Матрица для даты ${formattedDate}</title>
      <desc id="matrix-svg-description">Симметричная матрица с основными точками, внутренними узлами и кармическим хвостом.</desc>
      <g class="matrix-frame">
        <polygon class="matrix-frame--soft" points="310,34 506,114 586,310 506,506 310,586 114,506 34,310 114,114"></polygon>
        <rect x="114" y="114" width="392" height="392"></rect>
        <polygon points="310,34 586,310 310,586 34,310"></polygon>
        <polygon class="matrix-frame--soft" points="310,104 516,310 310,516 104,310"></polygon>
        <circle cx="310" cy="310" r="156"></circle>
        <line class="matrix-axis matrix-axis--neutral" x1="310" y1="68" x2="310" y2="552"></line>
        <line class="matrix-axis matrix-axis--neutral" x1="68" y1="310" x2="552" y2="310"></line>
        <line class="matrix-axis matrix-axis--blue" x1="142" y1="478" x2="478" y2="142"></line>
        <line class="matrix-axis matrix-axis--rose" x1="142" y1="142" x2="478" y2="478"></line>
      </g>

      ${node(310, 52, data.top, "violet", "major")}
      ${node(568, 310, data.right, "rose", "major")}
      ${node(310, 568, data.bottom, "rose", "major")}
      ${node(52, 310, data.left, "violet", "major")}

      ${node(128, 128, corners.topLeft, "plain", "medium")}
      ${node(492, 128, corners.topRight, "plain", "medium")}
      ${node(492, 492, corners.bottomRight, "plain", "medium")}
      ${node(128, 492, corners.bottomLeft, "plain", "medium")}

      ${node(310, 108, data.topSpoke.outer, "blue")}
      ${node(310, 158, data.topSpoke.near, "sky")}
      ${node(310, 216, data.topSpoke.core, "green")}
      ${node(108, 310, data.leftSpoke.outer, "blue")}
      ${node(158, 310, data.leftSpoke.near, "sky")}
      ${node(216, 310, data.leftSpoke.core, "green")}

      ${node(432, 310, data.rightSpoke.outer, "plain")}
      ${node(382, 310, data.rightSpoke.near, "gold")}
      ${node(356, 356, data.rightSpoke.core, "plain")}

      ${node(310, 388, data.tail.first, "gold")}
      ${node(310, 442, data.tail.second, "plain")}

      ${node(186, 186, diagonals.topLeft.outer, "plain")}
      ${node(230, 230, diagonals.topLeft.near, "plain")}
      ${node(434, 186, diagonals.topRight.outer, "plain")}
      ${node(390, 230, diagonals.topRight.near, "plain")}
      ${node(434, 434, diagonals.bottomRight.outer, "plain")}
      ${node(390, 390, diagonals.bottomRight.near, "plain")}
      ${node(186, 434, diagonals.bottomLeft.outer, "plain")}
      ${node(230, 390, diagonals.bottomLeft.near, "plain")}

      ${node(310, 310, data.center, "center", "center")}
    </svg>`;
};

const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
  result.hidden = true;
};

birthDateInput.addEventListener("input", () => {
  const digits = birthDateInput.value.replace(/\D/g, "").slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  birthDateInput.value = parts.join(".");
  error.hidden = true;
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const date = parseBirthDate(birthDateInput.value);
  if (!date) {
    showError("Введите существующую дату в формате ДД.ММ.ГГГГ.");
    birthDateInput.focus();
    return;
  }

  error.hidden = true;
  const formattedDate = birthDateInput.value;
  renderMatrix(calculateMatrix(date), formattedDate);
  resultTitle.textContent = `Матрица для ${formattedDate}`;
  result.hidden = false;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
});

backButton.addEventListener("click", () => {
  matrix.classList.remove("is-active");
  home.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
});

export const openMatrix = () => {
  home.classList.remove("is-active");
  matrix.classList.add("is-active");
  window.scrollTo({ top: 0, behavior: "instant" });
  window.setTimeout(() => birthDateInput.focus(), 220);
};
