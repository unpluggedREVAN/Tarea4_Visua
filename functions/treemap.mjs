import fetch from 'node-fetch';

export default async (req, context) => {
  const urls = {
    flare: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/flare.json",
    distritos: "https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/distritos_cr.json"
  };

  try {
    // hace fetch de forma paralela
    const responses = await Promise.all([
      fetch(urls.flare),
      fetch(urls.distritos)
    ]);

    const texts = await Promise.all(responses.map(response => response.text()));

    // se genera el html completo
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Multiple Treemaps</title>
          <style>
              .node {
                  border: solid 1px white;
                  font: 10px sans-serif;
                  line-height: 12px;
                  overflow: hidden;
                  position: absolute;
                  text-align: center;
              }
              .treemap-container {
                  margin: 20px;
                  position: relative;
                  width: 960px;
                  height: 570px;
                  border: 1px solid black;
              }
          </style>
          <script src="https://d3js.org/d3.v7.min.js"></script>
      </head>
      <body>
          <div id="treemap1" class="treemap-container"></div>
          <div id="treemap2" class="treemap-container"></div>
          <script>
            const flareDataText = \`${texts[0]}\`;
            const distritosDataText = \`${texts[1]}\`;

            const width = 960;
            const height = 570;

            const color = d3.scaleOrdinal(d3.schemeCategory10);

            const treemap = d3.treemap()
                .tile(d3.treemapSquarify)
                .size([width, height])
                .paddingInner(1)
                .round(true);

            function processFlareData(csvText) {
                const csvData = d3.csvParse(csvText);
                const root = {
                    name: "root",
                    children: []
                };

                const map = new Map();

                csvData.forEach(row => {
                    const id = row.id;
                    const value = +row.value;
                    const parts = id.split(".");

                    let current = root;

                    parts.forEach((part, index) => {
                        const currentPath = parts.slice(0, index + 1).join('.');
                        if (!map.has(currentPath)) {
                            const newNode = {
                                name: part,
                                children: []
                            };
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

            function processDistritoData(csvText) {
                const csvData = d3.csvParse(csvText);
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

            function drawTreemap(data, containerId) {
                const root = treemap(data);

                const svg = d3.select("#" + containerId).append("svg")
                    .attr("width", width)
                    .attr("height", height)
                    .style("font-family", "sans-serif");

                const node = svg.selectAll(".node")
                    .data(root.leaves())
                    .enter().append("g")
                    .attr("class", "node")
                    .attr("transform", d => \`translate(\${d.x0},\${d.y0})\`);

                node.append("rect")
                    .attr("id", d => d.data.name)
                    .attr("width", d => d.x1 - d.x0)
                    .attr("height", d => d.y1 - d.y0)
                    .attr("fill", d => color(d.parent.data.name));

                node.append("clipPath")
                    .attr("id", d => \`clip-\${d.data.name}\`)
                    .append("use")
                    .attr("xlink:href", d => \`#\${d.data.name}\`);

                node.append("text")
                    .attr("clip-path", d => \`url(#clip-\${d.data.name})\`)
                    .selectAll("tspan")
                    .data(d => d.data.name.split(/(?=[A-Z][^A-Z])/g))
                    .enter().append("tspan")
                    .attr("x", 3)
                    .attr("y", (d, i) => 13 + i * 10)
                    .text(d => d);

                node.append("title")
                    .text(d => \`\${d.data.name}\n\${d.value}\`);
            }

            const flareData = processFlareData(flareDataText);
            const distritosData = processDistritoData(distritosDataText);

            drawTreemap(flareData, "treemap1");
            drawTreemap(distritosData, "treemap2");
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
