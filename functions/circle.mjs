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
    // se hace todo el fetch en paralelo
    const responses = await Promise.all([
      fetch(urls.flare),
      fetch(urls.vue),
      fetch(urls.distritos)
    ]);

    const texts = await Promise.all(responses.map(response => response.text()));

    const dataFlare = d3.csvParse(texts[0]);
    const dataVue = d3.csvParse(texts[1]);
    const dataDistritos = d3.csvParse(texts[2]);

    // se procesa la información de los datasets
    const rootFlare = processFlareData(dataFlare);
    const rootVue = processVueData(dataVue);
    const rootDistritos = processDistritoData(dataDistritos);

    // se genera todo el html con los scripts para interactividad
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Zoomable Circle Packing Layout with D3.js</title>
          <style>
              .circle-container {
                  margin: 20px;
                  position: relative;
                  width: 960px;
                  height: 960px;
                  border: 1px solid black;
              }
          </style>
          <script src="https://d3js.org/d3.v7.min.js"></script>
      </head>
      <body>
          <div id="circle1" class="circle-container"></div>
          <div id="circle2" class="circle-container"></div>
          <div id="circle3" class="circle-container"></div>
          <script>
            const width = 960;
            const height = width;

            const color = d3.scaleLinear()
                .domain([0, 5])
                .range(["hsl(152,80%,80%)", "hsl(228,30%,40%)"])
                .interpolate(d3.interpolateHcl);

            const pack = data => d3.pack()
                .size([width, height])
                .padding(3)
                (d3.hierarchy(data)
                    .sum(d => d.value)
                    .sort((a, b) => b.value - a.value));

            function drawZoomableCirclePacking(data, containerId) {
                const root = pack(data);
                let focus = root;
                let view;

                const svg = d3.select("#" + containerId).append("svg")
                    .attr("viewBox", \`-\${width / 2} -\${height / 2} \${width} \${height}\`)
                    .attr("width", width)
                    .attr("height", height)
                    .attr("style", \`max-width: 100%; height: auto; display: block; margin: 0 -14px; background: \${color(0)}; cursor: pointer;\`);

                const node = svg.append("g")
                    .selectAll("circle")
                    .data(root.descendants().slice(1))
                    .join("circle")
                    .attr("fill", d => d.children ? color(d.depth) : "white")
                    .attr("pointer-events", d => !d.children ? "none" : null)
                    .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
                    .on("mouseout", function() { d3.select(this).attr("stroke", null); })
                    .on("click", (event, d) => focus !== d && (zoom(event, d), event.stopPropagation()));

                const label = svg.append("g")
                    .style("font", "10px sans-serif")
                    .attr("pointer-events", "none")
                    .attr("text-anchor", "middle")
                    .selectAll("text")
                    .data(root.descendants())
                    .join("text")
                    .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                    .style("display", d => d.parent === focus ? "inline" : "none")
                    .text(d => d.data.name);

                svg.on("click", (event) => zoom(event, root));
                zoomTo([root.x, root.y, root.r * 2]);

                function zoomTo(v) {
                    const k = width / v[2];

                    view = v;

                    label.attr("transform", d => \`translate(\${(d.x - v[0]) * k},\${(d.y - v[1]) * k})\`);
                    node.attr("transform", d => \`translate(\${(d.x - v[0]) * k},\${(d.y - v[1]) * k})\`);
                    node.attr("r", d => d.r * k);
                }

                function zoom(event, d) {
                    const focus0 = focus;

                    focus = d;

                    const transition = svg.transition()
                        .duration(event.altKey ? 7500 : 750)
                        .tween("zoom", d => {
                            const i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2]);
                            return t => zoomTo(i(t));
                        });

                    label
                        .filter(function(d) { return d.parent === focus || this.style.display === "inline"; })
                        .transition(transition)
                        .style("fill-opacity", d => d.parent === focus ? 1 : 0)
                        .on("start", function(d) { if (d.parent === focus) this.style.display = "inline"; })
                        .on("end", function(d) { if (d.parent !== focus) this.style.display = "none"; });
                }
            }

            const flareData = ${JSON.stringify(rootFlare)};
            const vueData = ${JSON.stringify(rootVue)};
            const distritosData = ${JSON.stringify(rootDistritos)};

            drawZoomableCirclePacking(flareData, "circle1");
            drawZoomableCirclePacking(vueData, "circle2");
            drawZoomableCirclePacking(distritosData, "circle3");
          </script>
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
        current.children = null;  // quita hijos por nodos hoja
      }
    });
  });

  return root;
}

function processVueData(csvData) {
  const root = { name: "root", children: [] };
  const map = new Map();
  map.set("root", root);

  csvData.forEach(row => {
    const id = row.pathname;
    const value = +row.size;
    const parts = id.split(/[/.]/); // corta por punto o por slash

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

  return root;
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

  return root;
}
