import { JSDOM } from 'jsdom';
import fetch from 'node-fetch';

export default async (req, context) => {
  const urls = {
    flare: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/flare.json",
    vue: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/vue.json",
    distritos: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/distritos_cr.json"
  };

  try {
    const responses = await Promise.all([
      fetch(urls.flare),
      fetch(urls.vue),
      fetch(urls.distritos)
    ]);

    const texts = await Promise.all(responses.map(response => response.text()));

    // Log the raw text responses for debugging
    console.log("Raw responses:", texts);

    const dataFlare = JSON.parse(texts[0]);
    const dataVue = JSON.parse(texts[1]);
    const dataDistritos = JSON.parse(texts[2]);

    const d3 = await import('d3');

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
    console.error("Error processing data:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

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
