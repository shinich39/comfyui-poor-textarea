"use strict";

import { api } from "../../scripts/api.js";
import { app } from "../../scripts/app.js";
import { ComfyWidgets } from "../../scripts/widgets.js";
import { init } from "./libs/poor-textarea.min.mjs";

app.registerExtension({
	name: "shinich39.PoorTextarea",
  init() {
    const STRING = ComfyWidgets.STRING;
    ComfyWidgets.STRING = function (node, inputName, inputData) {
      const r = STRING.apply(this, arguments);

      if (!inputData[1]?.multiline) {
        return r;
      }
      
      if (!r.widget?.element) {
        return r;
      }
    
      const elem = r.widget.element;

      init(elem, {
        pairs: {
          "{": "}",
          "(": ")",
        }
      });

      return r;
    };
	},
});