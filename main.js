import "@arcgis/core/assets/esri/themes/light/main.css";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import Graphic from "@arcgis/core/Graphic";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Expand from "@arcgis/core/widgets/Expand";
import LayerList from "@arcgis/core/widgets/LayerList";
import "@esri/calcite-components/dist/calcite/calcite.css";
import { setAssetPath } from "@esri/calcite-components/dist/components";
import "@esri/calcite-components/dist/components/calcite-block";
import "@esri/calcite-components/dist/components/calcite-chip";
import "@esri/calcite-components/dist/components/calcite-label";
import "@esri/calcite-components/dist/components/calcite-shell";
import "@esri/calcite-components/dist/components/calcite-shell-panel";
import "@esri/calcite-components/dist/components/calcite-switch";
import "@esri/calcite-components/dist/components/calcite-tab";
import "@esri/calcite-components/dist/components/calcite-tab-nav";
import "@esri/calcite-components/dist/components/calcite-tab-title";
import "@esri/calcite-components/dist/components/calcite-tabs";
import "@esri/calcite-components/dist/components/calcite-tile";
import {
  popupTemplate,
  renderer,
  skyConditionLabelClasses,
  temperatureLabelClasses,
  windLabelClass
} from "./lib";
import "./style.css";

setAssetPath("https://js.arcgis.com/calcite-components/1.0.4-next.4/assets");

// variable to hold any potential highlight handles
let highlightHandle = null;

// calcite button that switches between applying a where property
const whereSwitch = document.querySelector("#whereSwitch");

// graphic to reperest the 50 mile radius around a view click event on the map
const bufferGraphic = new Graphic({
  symbol: {
    type: "simple-fill",
    color: [173, 216, 230, 0.2],
    outline: {
      color: [255, 255, 255],
      width: 1
    }
  }
});

// graphic to represent a view click event on the map.
const clickGraphic = new Graphic({
  symbol: {
    type: "simple-marker",
    color: [100, 100, 100],
    outline: {
      color: [255, 255, 255],
      width: 1.5
    }
  }
});

const stationsLayer = new FeatureLayer({
  labelingInfo: [...skyConditionLabelClasses, ...temperatureLabelClasses, windLabelClass],
  outFields: ["OBJECTID", "COUNTRY", "TEMP", "WIND_DIRECT", "WIND_SPEED"],
  popupTemplate,
  popupEnabled: false,
  renderer,
  title: "Stations",
  url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NOAA_METAR_current_wind_speed_direction_v1/FeatureServer/0"
});

const watchesLayer = new FeatureLayer({
  title: "Watches",
  url: "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/NWS_Watches_Warnings_v1/FeatureServer/6"
});

const wellsLayer = new FeatureLayer({
  title: "Wells",
  url: "https://services2.arcgis.com/ZOdjAzAQ2B0f85zi/ArcGIS/rest/services/Oil_and_Gas_Wells/FeatureServer/0"
});

const map = new Map({
  basemap: "streets-navigation-vector",
  layers: [watchesLayer, wellsLayer, stationsLayer]
});

const view = new MapView({
  map,
  center: {
    latitude: 39.9,
    longitude: -105
  },
  container: "viewDiv",
  zoom: 7
});

/**
 * Function to invoke queryLayerViewCounts() when the view becomes stationary
 * and add a click event to the view to invoke queryLayerViewFeatures().
 * Add a LayerList widget with a legend embedded
 */
const setup = async () => {
  reactiveUtils.watch(
    () => [view.stationary, view.extent],
    ([stationary, extent]) => {
      if (stationary) {
        queryLayerViewCounts(extent);
      }
    }
  );

  view.on("click", (event) => {
    view.graphics.removeAll();
    queryLayerViewFeatures(event);
  });

  const layerList = new LayerList({
    view: view,
    listItemCreatedFunction: (event) => {
      const item = event.item;
      if (item.layer.type != "group") {
        // don't show legend twice
        item.panel = {
          content: "legend",
          open: true
        };
      }
    }
  });

  const expand = new Expand({
    content: layerList,
    expandTooltip: "Layer List",
    view
  });

  view.ui.add(expand, "top-right");
};

/**
 * Function to query initial feature counts on the weather layers and update the html
 */
const queryLayerCounts = async () => {
  // query the number of features in the weather stations layer update and the html
  const stationsLayerCount = await stationsLayer.queryFeatureCount();
  document.getElementById("stationsLayerCount").innerText = stationsLayerCount;

  // query the number of features in the weather stations layer update the html
  const watchesLayerCount = await watchesLayer.queryFeatureCount();
  document.getElementById("watchesLayerCount").innerText = watchesLayerCount;

  // query the number of features in the new york footprints layer update the html
  const wellsLayerCount = await wellsLayer.queryFeatureCount();
  document.getElementById("wellsLayerCount").innerText = wellsLayerCount;
};

/**
 * Function that queries counts for layers and views
 */
const queryLayerViewCounts = async (extent) => {
  // wait for the  layer views to be loaded in the view
  const stationsLayerView = await view.whenLayerView(stationsLayer);
  const watchesLayerView = await view.whenLayerView(watchesLayer);
  const wellsLayerView = await view.whenLayerView(wellsLayer);

  // wait for the layer views to stop updating
  reactiveUtils
    .whenOnce(
      () =>
        stationsLayerView.updating === false &&
        watchesLayerView.updating === false &&
        wellsLayerView.updating === false
    )
    .then(async () => {
      // query the number of features in the weather stations layer view and update the html
      const stationsLayerViewCount = await stationsLayerView.queryFeatureCount();
      document.getElementById("stationsLayerViewCount").innerText = stationsLayerViewCount;

      // query the number of features in the weather stations layer view in the view extent and update the html
      const stationsExtentQuery = stationsLayerView.createQuery();
      stationsExtentQuery.geometry = extent;
      const stationsLayerViewExtentCount = await stationsLayerView.queryFeatureCount(
        stationsExtentQuery
      );
      document.getElementById("stationsLayerViewExtentCount").innerText =
        stationsLayerViewExtentCount;

      // query the number of features in the weather watches and warnings layer view and update the html
      const watchesLayerViewCount = await watchesLayerView.queryFeatureCount();
      document.getElementById("watchesLayerViewCount").innerText = watchesLayerViewCount;

      // query the number of features in the weather watches and warnings layer view in the view extent and update the html
      const watchesExtentQuery = watchesLayerView.createQuery();
      watchesExtentQuery.geometry = extent;
      const watchesLayerViewExtentCount = await watchesLayerView.queryFeatureCount(
        watchesExtentQuery
      );
      document.getElementById("watchesLayerViewExtentCount").innerText =
        watchesLayerViewExtentCount;

      // query the number of features in the oil and gas wells layer view and update the html
      const wellsLayerViewCount = await wellsLayerView.queryFeatureCount();
      document.getElementById("wellsLayerViewCount").innerText = wellsLayerViewCount;

      // query the number of features in the oil and gas wells layer view in the view extent and update the html
      const wellsExtentQuery = wellsLayerView.createQuery();
      wellsExtentQuery.geometry = extent;
      const wLayerViewExtentCount = await wellsLayerView.queryFeatureCount(wellsExtentQuery);
      document.getElementById("wellsLayerViewExtentCount").innerText = wLayerViewExtentCount;
    });
};

/**
 * Function that queries features and summary statistics from a LayerView based
 * on a screenPoint from a map click.
 */
const queryLayerViewFeatures = async (screenPoint) => {
  // add a graphic to the view at the click event's location
  const point = view.toMap(screenPoint);
  const newClickGraphic = clickGraphic.clone();
  newClickGraphic.geometry = point;
  view.graphics.add(newClickGraphic);

  const stationsLayerView = await view.whenLayerView(stationsLayer);

  // create a query that selects all features within 50 miles of the point
  const query = stationsLayerView.createQuery();
  query.geometry = point;
  query.distance = 50;
  query.units = "miles";
  query.spatialRelationship = "intersects";
  query.returnGeometry = false;
  query.returnQueryGeometry = true;

  if (whereSwitch.checked) {
    query.where = "COUNTRY = 'Colorado, United States Of America'";
  }

  // create a feature set from the layer view using the 50 mile query
  const featureSet = await stationsLayerView.queryFeatures(query);

  // highlight the features present in the feature set in the layer view
  const ids = featureSet.features.map((feature) => feature.attributes.OBJECTID);
  if (highlightHandle) {
    highlightHandle.remove();
    highlightHandle = null;
  }
  highlightHandle = stationsLayerView.highlight(ids);

  // create a new graphic for the 50 mile search radius and add it to the view's graphics collection
  const newBufferGraphic = bufferGraphic.clone();
  newBufferGraphic.geometry = featureSet.queryGeometry;
  view.graphics.add(newBufferGraphic);

  // create a clone of the 50 mile query to calculate statistics
  const statisticsQuery = query.clone();
  statisticsQuery.outStatistics = [
    {
      onStatisticField: "OBJECTID",
      outStatisticFieldName: "COUNT",
      statisticType: "count"
    },
    {
      onStatisticField: "WIND_SPEED",
      outStatisticFieldName: "AVG_WIND_SPEED",
      statisticType: "avg"
    }
  ];

  // query the layerview to calculate the statistics
  const statisticsFeatureSet = await stationsLayerView.queryFeatures(statisticsQuery);

  //  add the statistics to the calcite chips in the html
  document.getElementById("stationsClickCount").innerText =
    statisticsFeatureSet.features[0].attributes.COUNT;
  document.getElementById("stationsClickAverageWindSpeed").innerText =
    Math.floor(statisticsFeatureSet.features[0].attributes.AVG_WIND_SPEED) + "km/h";
};

view.when(() => {
  setup();
  queryLayerCounts();
  queryLayerViewCounts();
});
