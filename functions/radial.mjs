import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import * as d3 from 'd3';
import Papa from 'papaparse';

export default async (req, context) => {
  const urls = {
    flare: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/flare.json",
    vue: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/vue.json",
    distritos: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/distritos_cr.json"
  };

  try {
    // Fetch all data in parallel
    const responses = await Promise.all([
      fetch(urls.flare),
      fetch(urls.vue),
      fetch(urls.distritos)
    ]);

    const texts = await Promise.all(responses.map(response => response.text()));

    // Log the raw text responses for debugging
    console.log("Raw responses:", texts);

    const dataFlare = processFlareData(Papa.parse(texts[0], { header: true }).data);
    const dataVue = processVueData(Papa.parse(texts[1], { header: true }).data);
    const dataDistritos = processDistritoData(Papa.parse(texts[2], { header: true }).data);

    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    const body = d3.select(dom.window.document.querySelector("body"));

    const width = 960;
    const height = 960;
    const radius = width / 2;

    const tree = d3.tree()
      .size([2 * Math.PI, radius - 100])
      .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const svgFlare = drawRadialLayout(d3, dataFlare, body, width, height, radius, tree, color);
    const svgVue = drawRadialLayout(d3, dataVue, body, width, height, radius, tree, color);
    const svgDistritos = drawRadialLayout(d3, dataDistritos, body, width, height, radius, tree, color);

    const responseHtml = `
      <div id="radial1" class="radial-container">${svgFlare}</div>
      <div id="radial2" class="radial-container">${svgVue}</div>
      <div id="radial3" class="radial-container">${svgDistritos}</div>
    `;

    return new Response(responseHtml, {
      headers: { "Content-Type": "text/html" }
    });

  } catch (error) {
    console.error("Error processing data:", error.message, error.stack);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), { status: 500 });
  }
};

function processFlareData(csvData) {
  const root = { name: "root", children: [] };
  const map = new Map();

  csvData.forEach(row => {
    const id = row.id;
    const value = +row.value;
    const parts = id.split(".");

    let current = root;

    parts.forEach((part, index) => {
      const currentPath = parts.slice(0, index + 1).join('.');
      if (!map.has(currentPath)) {
        const newNode = { name: part, children: [] };
        current.children.push(newNode);
        map.set(currentPath, newNode);
      }

      current = map.get(currentPath);

      if (index === parts.length - 1) {
        current.value = value;
        current.children = null;  // remove children for leaf nodes
      }
    });
  });

  return d3.hierarchy(root)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);
}

function processVueData(csvData) {
  const root = { name: "root", children: [] };
  const map = new Map();
  map.set("root", root);

  csvData.forEach(row => {
    const id = row.pathname;
    const value = +row.size;
    const parts = id.split(/[/.]/); // split by dot or slash

    let current = root;

    parts.forEach((part, index) => {
      const currentPath = parts.slice(0, index + 1).join('/');
      if (!map.has(currentPath)) {
        const newNode = { name: part, children: [] };
        if (current.children) {
          current.children.push(newNode);
        } else {
          current.children = [newNode];
        }
        map.set(currentPath, newNode);
      }

      current = map.get(currentPath);

      if (index === parts.length - 1) {
        current.value = value;
        current.children = null;  // remove children for leaf nodes
      }
    });
  });

  return d3.hierarchy(root)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);
}

function processDistritoData(csvData) {
  const root = { name: "Costa Rica", children: [] };
  const levels = { 'Costa Rica': root };

  csvData.forEach(row => {
    const path = row.ID.split('.');
    const value = +row.POBL_2022;
    let currentLevel = root;

    for (let i = 0; i < path.length - 1; i++) {
      const part = path[i];
      const partId = path.slice(0, i + 1).join('.');

      if (!levels[partId]) {
        const newPart = { name: part, children: [] };
        levels[partId] = newPart;
        currentLevel.children.push(newPart);
      }
      currentLevel = levels[partId];
    }

    currentLevel.children.push({ name: path[path.length - 1], value: value });
  });

  return d3.hierarchy(root)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);
}

function drawRadialLayout(d3, data, body, width, height, radius, tree, color) {
  const root = d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.height - a.height || b.value - a.value);

  tree(root);

  const svg = body.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font-family", "sans-serif")
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  const link = svg.append("g")
    .selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("d", d3.linkRadial()
      .angle(d => d.x)
      .radius(d => d.y));

  const node = svg.append("g")
    .selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("class", "node")
    .attr("transform", d => `
      rotate(${d.x * 180 / Math.PI - 90})
      translate(${d.y},0)
    `);

  node.append("circle")
    .attr("r", 2.5)
    .attr("fill", d => color(d.depth));

  node.append("text")
    .attr("dy", "0.31em")
    .attr("x", d => d.x < Math.PI === !d.children ? 6 : -6)
    .attr("text-anchor", d => d.x < Math.PI === !d.children ? "start" : "end")
    .attr("transform", d => d.x >= Math.PI ? "rotate(180)" : null)
    .text(d => d.data.name)
    .clone(true).lower()
    .attr("stroke", "white");

  return body.html();
}
