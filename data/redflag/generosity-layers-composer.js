import { reduce22 } from "../../numerology-core.js?v=1";

const bank = await fetch(new URL("./drafts/money-generosity-layers.json", import.meta.url))
  .then((response) => response.json());

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
  const giving = bank.scales.giving.values[moneyFlow];
  const disappointment = bank.scales.disappointment.values[moneyBlock];

  return {
    verdict: `${selectVerdict(giving, bank.scales.verdicts.giving)}. ${selectVerdict(disappointment, bank.scales.verdicts.disappointment)}.`,
    paragraphs: [
      bank.layers.flow.texts[moneyFlow],
      bank.layers.block.texts[moneyBlock],
      bank.layers.earning.texts[earning]
    ],
    scales: [
      { label: bank.scales.giving.label, value: giving },
      { label: bank.scales.disappointment.label, value: disappointment }
    ],
    observation: "Смотри не на один красивый жест, а на то, остаётся ли участие тёплым и спокойным после траты.",
    trace: { moneyFlow, moneyBlock, earning }
  };
};
