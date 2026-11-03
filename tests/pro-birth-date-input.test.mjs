import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseBirthDate } from "../numerology-core.js";

const script=await readFile(new URL("../pro/pro.js",import.meta.url),"utf8");
const page=await readFile(new URL("../pro/index.html",import.meta.url),"utf8");
const match=script.match(/function formatProBirthDate\(value, deleting = false\) \{[\s\S]*?\n\}/);
assert.ok(match,"Birth date formatter exists");
const format=Function(match[0]+";return formatProBirthDate;")();

test("iPhone numeric keypad automatically displays a dot after day and month",()=>{
  const expected=["0","09.","09.1","09.10.","09.10.1","09.10.19","09.10.198","09.10.1988"];
  let value="";
  for(const [index,digit] of Array.from("09101988").entries()){
    value=format(value+digit,false);
    assert.equal(value,expected[index]);
  }
  assert.deepEqual(parseBirthDate(value),{day:9,month:10,year:1988});
});

test("deleting an inserted dot works without trapping Backspace",()=>{
  assert.equal(format("09",true),"09");
  assert.equal(format("09.10",true),"09.10");
  assert.equal(format("09.1",true),"09.1");
  assert.equal(format("09.10.198",true),"09.10.198");
  assert.equal(format("0",true),"0");
});

test("pasting a date, dot, slash and long digits keeps the same accepted format",()=>{
  for(const raw of ["31.10.1988","31/10/1988","31101988","31 10 1988"]){
    assert.equal(format(raw),"31.10.1988");
  }
  assert.equal(format("090919861234"),"09.09.1986");
  assert.equal(parseBirthDate(format("31101988")).year,1988);
});

test("page uses freshly versioned script and retains number keypad and existing form",()=>{
  assert.match(page,/id="pro-birth-date" type="text" inputmode="numeric"/);
  assert.match(page,/pro\/pro\.js\?v=20261103dots1/);
  assert.match(script,/input\.value=formatProBirthDate\(input\.value,deleting\)/);
  assert.match(script,/const schoolClientMode = new URLSearchParams/);
  assert.match(script,/verifiedSchoolClientOwner/);
  assert.match(script,/createFullReportPdfButton/);
});
