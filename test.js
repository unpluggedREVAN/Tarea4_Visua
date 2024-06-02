import { JSDOM } from 'jsdom';

const { window } = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
console.log(window.document.querySelector("p").textContent); // should print "Hello world"
