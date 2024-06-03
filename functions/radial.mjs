import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';
import * as d3 from 'd3';

export default async (req, context) => {
  const urls = {
    flare: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/flare.json",
    vue: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/vue.json",
    distritos: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/distritos_cr.json"
  };

  try {
    // hace fetch
    const responses = await Promise.all([
      fetch(urls.flare),
      fetch(urls.vue),
      fetch(urls.distritos)
    ]);

    const texts = await Promise.all(responses.map(response => response.text()));

    const dataFlare = d3.csvParse(texts[0]);
    const dataVue = d3.csvParse(texts[1]);
    const dataDistritos = d3.csvParse(texts[2]);

    // procesamiento de la información
    const rootFlare = processFlareData(dataFlare);
    const rootVue = processVueData(dataVue);
    const rootDistritos = processDistritoData(dataDistritos);

    // se dibuja el layout y devuelve el html
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Radial Layout with D3.js</title>
          <style>
              .node {
                  font: 10px sans-serif;
              }
              .link {
                  fill: none;
                  stroke: #555;
                  stroke-opacity: 0.4;
                  stroke-width: 1.5px;
              }
              .radial-container {
                  margin: 20px;
                  position: relative;
                  width: 960px;
                  height: 960px;
                  border: 1px solid black;
              }
          </style>
      </head>
      <body>
          <div id="radial1" class="radial-container">${drawRadialLayout(rootFlare)}</div>
          <div id="radial2" class="radial-container">${drawRadialLayout(rootVue)}</div>
          <div id="radial3" class="radial-container">${drawRadialLayout(rootDistritos)}</div>
      </body>
      </html>
    `;

    return new Response(html, {
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
        current.children = null;  // quita hijos para nodos hoja
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
    const parts = id.split(/[/.]/); // partir por punto o por slash

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
        current.children = null;  // quita hijos por nodos hoja
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

function drawRadialLayout(root) {
  const { document } = (new JSDOM(`<!DOCTYPE html><body></body>`)).window;
  const body = d3.select(document.body);

  const width = 960;
  const height = 960;
  const radius = width / 2;

  const tree = d3.tree()
    .size([2 * Math.PI, radius - 100])
    .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

  const color = d3.scaleOrdinal(d3.schemeCategory10);

  tree(root);

  const svg = body.append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("font-family", "sans-serif")
    .append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

  svg.append("g")
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
