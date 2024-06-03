import fetch from 'node-fetch';

export default async (req, context) => {
  const url = 'https://raw.githubusercontent.com/unpluggedREVAN/Tarea_4_Visua/main/states_usa.bna.html';

  try {
    const response = await fetch(url);
    const textData = await response.text();

    const html = `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Mapa de Estados de USA</title>
        </head>
        <body>
          <svg class="demo" id="demo" width="1000" height="1000"></svg>
          <script type="module">
            import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

            var xScale = d3.scaleLinear().domain([-66.419422, -125.786406]).range([350 * 2, 20]);
            var yScale = d3.scaleLinear().domain([23.982057, 50.508481]).range([200 * 2, 50]);

            async function prepareCoord() {
              var csvContent = \`${textData}\`;
              var arrayCoord = csvContent.split('\\n');
              var newCoord = [];
              var posc = 0;
              var areaAll = [];
              var listCoord = [];
              arrayCoord.forEach(elem => {
                elem = elem.split(',');
                if (elem.length == 3) {
                  newCoord = newCoord.concat({ id: elem[0], idUser: elem[1], numState: elem[2], coord: [] });
                  if (listCoord.length != 0) {
                    areaAll = areaAll.concat([listCoord]); //[{x:,y:},...,{x:,y:}]
                  }
                  posc++;
                  listCoord = [];
                } else {
                  newCoord[posc - 1].coord = { x: elem[0], y: elem[1] };
                  listCoord = listCoord.concat({ x: elem[0], y: elem[1] });
                }
              });
              return [newCoord, areaAll];
            }

            let prepareCoordRes = await prepareCoord();
            let coord = prepareCoordRes[0];
            let areaAll = prepareCoordRes[1];
            console.log(areaAll);

            var area = d3.area()
              .x(d => xScale(d.x))
              .y0(d => yScale(d.y))
              .y1(d => yScale(d.y));

            const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

            let randomColor;
            areaAll.forEach(element => {
              randomColor = colorScale(Math.floor(Math.random() * 10));
              d3.select("#demo")
                .append("path")
                .attr("d", area(element))
                .attr("fill", randomColor)
                .attr("stroke", "#000000"); // Cambiar el color de la línea
            });
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
