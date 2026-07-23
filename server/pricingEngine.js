function money(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function pct(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
}

function number(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}


function dimensionInches(unit, axis) {
  const inchKey = `${axis}In`;
  const ftKey = `${axis}Ft`;
  const inches = number(unit[inchKey]);
  if (inches > 0) return inches;

  // Backward compatibility for older quote payloads that used feet.
  const feet = number(unit[ftKey]);
  return feet > 0 ? feet * 12 : 0;
}

function dimensionFeet(unit, axis) {
  return dimensionInches(unit, axis) / 12;
}

function totalSquareFeet(unit) {
  const override = number(unit.totalSf);
  if (override > 0) return override;

  const heightIn = dimensionInches(unit, "height");
  const widthIn = dimensionInches(unit, "width");
  if (heightIn > 0 && widthIn > 0) return (heightIn * widthIn) / 144;

  return 0;
}

function formatDimensionInches(value) {
  const n = number(value);
  if (!n) return "";
  return Number.isInteger(n) ? `${n}"` : `${money(n)}"`;
}

function selectedAddOnNames(unit) {
  const addOns = unit.addOns || {};
  if (Array.isArray(addOns)) return addOns;
  return Object.entries(addOns)
    .filter(([, selected]) => selected === true || selected === "Yes" || selected === "yes")
    .map(([name]) => name);
}

function driverBasis(driver, unit) {
  switch (driver) {
    case "Glass":
      return number(unit.glassSf);
    case "Slabs":
      return number(unit.slabs);
    case "Each":
      return 1;
    case "SF":
    default:
      return totalSquareFeet(unit);
  }
}

export function getDefaultDiscount(data, customerType, discountTier) {
  return number(data?.discounts?.[customerType]?.[discountTier], 0);
}

export function getUnitDiscount(unit, quote, data) {
  const override = unit.discountOverride;
  if (override !== undefined && override !== null && override !== "") {
    return number(override);
  }

  return getDefaultDiscount(
    data,
    quote.customerType || "Retail",
    quote.discountTier || "Low"
  );
}

export function calculateUnit(unit, quote, data) {
  const style = unit.style || "Traditional";
  const stylePricing = data.styles[style];

  if (!stylePricing) {
    throw new Error(`Unknown style: ${style}`);
  }

  const qty = Math.max(number(unit.quantity, 1), 0);
  const heightIn = dimensionInches(unit, "height");
  const widthIn = dimensionInches(unit, "width");
  const heightFt = dimensionFeet(unit, "height");
  const widthFt = dimensionFeet(unit, "width");
  const totalSf = totalSquareFeet(unit);
  const glassSf = number(unit.glassSf);
  const slabs = number(unit.slabs, 1);

  const basePrice = number(stylePricing.pricePerSf) * totalSf;

  const selected = selectedAddOnNames(unit);
  const addOnLines = data.addOns
    .filter((addOn) => addOn.active !== false && selected.includes(addOn.name))
    .map((addOn) => {
      const basis = driverBasis(addOn.driver, { ...unit, totalSf, glassSf, slabs });
      const unitPrice = number(addOn.prices?.[style]) * basis;

      return {
        name: addOn.name,
        driver: addOn.driver,
        units: addOn.units,
        basis: money(basis),
        unitPrice: money(unitPrice)
      };
    });

  const addOnsPrice = addOnLines.reduce((sum, addOn) => sum + addOn.unitPrice, 0);

  const unitPriceBeforeDiscount = basePrice + addOnsPrice;
  const discountRate = getUnitDiscount(unit, quote, data);

  // IMPORTANT:
  // Door-unit retail is the base door price PLUS every selected add-on.
  // The customer discount applies once to that complete door-unit retail amount.
  // Installation is calculated separately and is not part of this door-unit discount.
  const discountAmountPerUnit = unitPriceBeforeDiscount * discountRate;
  const unitPriceAfterDiscount = unitPriceBeforeDiscount - discountAmountPerUnit;

  const lineRetailRevenue = unitPriceBeforeDiscount * qty;
  const lineDiscountAmount = discountAmountPerUnit * qty;
  const lineMaterialRevenue = unitPriceAfterDiscount * qty;

  const installPricePerUnit = number(
    unit.installPricePerUnit,
    data.install?.[unit.buildType] ?? 0
  );

  return {
    id: unit.id,
    name: unit.name || `Unit ${unit.id || ""}`.trim(),
    style,
    buildType: unit.buildType || "New Build",
    heightIn: money(heightIn),
    widthIn: money(widthIn),
    heightFt: money(heightFt),
    widthFt: money(widthFt),
    totalSf: money(totalSf),
    glassSf: money(glassSf),
    slabs,
    quantity: qty,
    swing: unit.swing || "",
    accessibility: unit.accessibility || "",
    color: unit.color || "",
    glassTexture: unit.glassTexture || "",
    glassColor: unit.glassColor || "",
    selectedAddOns: addOnLines.map((addOn) => addOn.name),
    addOnLines,
    basePrice: money(basePrice),
    addOnsPrice: money(addOnsPrice),
    unitPriceBeforeDiscount: money(unitPriceBeforeDiscount),
    discountRate: pct(discountRate),
    discountAmountPerUnit: money(discountAmountPerUnit),
    unitPriceAfterDiscount: money(unitPriceAfterDiscount),
    lineRetailRevenue: money(lineRetailRevenue),
    lineDiscountAmount: money(lineDiscountAmount),
    lineMaterialRevenue: money(lineMaterialRevenue),
    installPricePerUnit: money(installPricePerUnit)
  };
}

export function calculateQuote(quote, data) {
  const units = (quote.units || []).filter((unit) => {
    const qty = number(unit.quantity, 0);
    const totalSf = totalSquareFeet(unit);
    return qty > 0 && unit.style && totalSf > 0;
  });

  const calculatedUnits = units.map((unit, index) =>
    calculateUnit({ ...unit, id: unit.id ?? index + 1 }, quote, data)
  );

  const materialRetailSubtotal = calculatedUnits.reduce(
    (sum, unit) => sum + unit.lineRetailRevenue,
    0
  );

  const materialDiscountAmount = calculatedUnits.reduce(
    (sum, unit) => sum + unit.lineDiscountAmount,
    0
  );

  const materialSubtotal = calculatedUnits.reduce(
    (sum, unit) => sum + unit.lineMaterialRevenue,
    0
  );

  const installationGross = calculatedUnits.reduce(
    (sum, unit) => sum + unit.installPricePerUnit * unit.quantity,
    0
  );

  const installationDiscountRate = number(quote.installationDiscountRate, 0);
  const installationDiscountAmount = installationGross * installationDiscountRate;
  const installationNet = installationGross - installationDiscountAmount;

  // Installation is calculated at the quote level and presented as its own
  // separate line. It is intentionally not allocated into individual door rows.
  const suggestedRetail = materialRetailSubtotal + installationGross;
  const totalDiscountAmount = materialDiscountAmount + installationDiscountAmount;
  const quoteTotal = materialSubtotal + installationNet;
  const productionDepositRate = number(quote.productionDepositRate, 0.5);
  // Production deposit is based only on the discounted door/material price.
  // Installation and other service charges are excluded from the deposit basis.
  const productionDepositBasis = materialSubtotal;
  const productionDepositDue = productionDepositBasis * productionDepositRate;

  const externalUnits = calculatedUnits.map((unit) => ({
    id: unit.id,
    name: unit.name,
    style: unit.style,
    buildType: unit.buildType,
    dimensions: `${formatDimensionInches(unit.widthIn)} × ${formatDimensionInches(unit.heightIn)}`,
    widthIn: unit.widthIn,
    heightIn: unit.heightIn,
    totalSf: unit.totalSf,
    glassSf: unit.glassSf,
    slabs: unit.slabs,
    quantity: unit.quantity,
    swing: unit.swing,
    accessibility: unit.accessibility,
    color: unit.color,
    glassTexture: unit.glassTexture,
    glassColor: unit.glassColor,
    selectedAddOns: unit.selectedAddOns,
    discountRate: unit.discountRate,
    unitRetailPrice: unit.unitPriceBeforeDiscount,
    unitDiscountAmount: unit.discountAmountPerUnit,
    unitPrice: unit.unitPriceAfterDiscount,
    lineRetailRevenue: unit.lineRetailRevenue,
    lineDiscountAmount: unit.lineDiscountAmount,
    lineMaterialRevenue: unit.lineMaterialRevenue
  }));

  const result = {
    quoteNumber: quote.quoteNumber || null,
    preparedFor: quote.preparedFor || {},
    preparedBy: quote.preparedBy || {},
    customerType: quote.customerType || "Retail",
    discountTier: quote.discountTier || "Low",
    workScope: Array.isArray(quote.workScope) ? quote.workScope.filter(Boolean) : [],
    units: externalUnits,
    totals: {
      materialRetailSubtotal: money(materialRetailSubtotal),
      materialDiscountAmount: money(materialDiscountAmount),
      materialSubtotal: money(materialSubtotal),
      installationGross: money(installationGross),
      installationDiscountRate: pct(installationDiscountRate),
      installationDiscountAmount: money(installationDiscountAmount),
      installationNet: money(installationNet),
      suggestedRetail: money(suggestedRetail),
      totalDiscountAmount: money(totalDiscountAmount),
      quoteTotal: money(quoteTotal),
      productionDepositRate: pct(productionDepositRate),
      productionDepositBasis: money(productionDepositBasis),
      productionDepositDue: money(productionDepositDue)
    }
  };

  return result;
}

export function makeSampleQuote() {
  return {
    quoteNumber: "",
    preparedFor: {
      company: "",
      contact: ""
    },
    preparedBy: {
      name: "",
      email: "",
      phone: ""
    },
    customerType: "",
    discountTier: "",
    installationDiscountRate: 0,
    productionDepositRate: 0.5,
    workScope: [],
    units: []
  };
}

export function sanitizePricingForClient(data) {
  const publicStyles = Object.fromEntries(
    Object.entries(data.styles || {}).map(([name, style]) => [
      name,
      { pricePerSf: money(style.pricePerSf) }
    ])
  );

  const publicAddOns = (data.addOns || [])
    .filter((addOn) => addOn.active !== false)
    .map((addOn) => ({
    name: addOn.name,
    active: true,
    units: addOn.units,
    driver: addOn.driver,
    prices: Object.fromEntries(
      Object.entries(addOn.prices || {}).map(([style, price]) => [
        style,
        money(price)
      ])
    )
  }));

  return {
    metadata: {
      discountPolicy: data.metadata.discountPolicy,
      installDiscountPolicy: data.metadata.installDiscountPolicy,
      sourceRevision: data.metadata.sourceRevision
    },
    referenceLists: data.referenceLists,
    publicPricing: {
      styles: publicStyles,
      addOns: publicAddOns
    },
    addOns: publicAddOns.map((addOn) => ({
      name: addOn.name,
      units: addOn.units,
      driver: addOn.driver
    }))
  };
}
