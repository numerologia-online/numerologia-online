import { reduce22 } from "../../numerology-core.js?v=1";

const [bank, scales] = await Promise.all([
  fetch(new URL("./drafts/money-generosity-layers.json", import.meta.url)).then((response) => response.json()),
  fetch(new URL("./drafts/money-generosity-scales.json", import.meta.url)).then((response) => response.json())
]);

const selectVerdict = (score, verdicts) => score <= 3
  ? verdicts.low
  : score <= 6
    ? verdicts.middle
    : verdicts.high;

const calculateEnergies = (matrix) => {
  const moneyFlow = reduce22(matrix.right + matrix.center);
  const moneyBlock = reduce22(matrix.right + moneyFlow);
  const earning = reduce22(moneyFlow + matrix.center);
  return { moneyFlow, moneyBlock, earning };
};

export const answerGenerosityLayers = (matrix) => {
  const { moneyFlow, moneyBlock, earning } = calculateEnergies(matrix);
  const giving = scales.giving.values[moneyFlow];
  const disappointment = scales.disappointment.values[moneyBlock];

  return {
    verdict: `${selectVerdict(giving, scales.verdicts.giving)}. ${selectVerdict(disappointment, scales.verdicts.disappointment)}.`,
    paragraphs: [
      bank.layers.flow.texts[moneyFlow],
      bank.layers.block.texts[moneyBlock],
      bank.layers.earning.texts[earning]
    ],
    scales: [
      { label: scales.giving.label, value: giving },
      { label: scales.disappointment.label, value: disappointment }
    ],
    observation: scales.observation,
    trace: { moneyFlow, moneyBlock, earning }
  };
};
