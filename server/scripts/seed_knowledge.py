"""Submit 66 sourced agricultural FAQs for Paniqui LGU validation.

Run from server: py -3.12 scripts/seed_knowledge.py --apply
Without --apply this only checks the content structure. Stable IDs preserve
article text edited by LGU staff. Importing never approves an article.
"""

import argparse
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import sys
from urllib.parse import urlparse


SOURCES = {
    'palay': ('DA-PhilRice: PalayCheck System', 'https://www.philrice.gov.ph/wp-content/uploads/2023/02/PalayCheck-System-2022-Revised-Edition.pdf'),
    'land': ('DA-PhilRice: Basics of land preparation', 'https://www.philrice.gov.ph/basics-land-preparation/'),
    'variety': ('IRRI: Rice varieties', 'https://www.knowledgebank.irri.org/step-by-step-production/pre-planting/rice-varieties'),
    'seed': ('IRRI: Seed quality', 'https://www.knowledgebank.irri.org/step-by-step-production/pre-planting/seed-quality'),
    'nursery': ('IRRI: Preparing rice seedlings for transplanting', 'https://www.knowledgebank.irri.org/step-by-step-production/growth/planting/how-to-prepare-the-seedlings-for-transplanting'),
    'nitrogen': ('IRRI: Nitrogen deficiency', 'https://www.knowledgebank.irri.org/training/fact-sheets/nutrient-management/deficiencies-and-toxicities-fact-sheet/item/nitrogen-deficiency'),
    'zinc': ('IRRI: Zinc in rice', 'https://www.knowledgebank.irri.org/training/fact-sheets/nutrient-management/item/zinc-factsheet'),
    'snail': ('IRRI: Golden apple snails', 'https://www.knowledgebank.irri.org/step-by-step-production/growth/pests-and-diseases/golden-apple-snails'),
    'sheath': ('IRRI: Sheath blight', 'https://www.knowledgebank.irri.org/training/fact-sheets/pest-management/diseases/item/sheath-blight'),
    'thrips': ('IRRI: Rice thrips', 'https://www.knowledgebank.irri.org/training/fact-sheets/pest-management/insects/item/rice-thrips'),
    'awd': ('IRRI: Alternate wetting and drying', 'https://www.knowledgebank.irri.org/training/fact-sheets/water-management/saving-water-alternate-wetting-drying-awd'),
    'corn': ('DA-ATI: Corn production, nine basic steps', 'https://ati2.da.gov.ph/ati-5/content/sites/default/files/users/user17/Corn%20Production%20%289%20Basic%20Steps%20for%20Bountiful%20Harvest%29.pdf'),
    'cornpest': ('DA-SAAD: Corn and vegetable integrated pest management', 'https://saad.da.gov.ph/saad-wesvis-trains-106-vegetable-corn-growers-on-integrated-pest-management/'),
    'earworm': ('DA-CAR: Corn earworm management', 'https://car.da.gov.ph/wp-content/uploads/2024/02/Corn-Pest_earworm_Ver02_Final-1.pdf'),
    'faw': ('Department of Agriculture: Fall armyworm management guidelines', 'https://www.da.gov.ph/wp-content/uploads/2021/04/mo26_s2021.pdf'),
    'vegetable': ('FAO: Growing vegetables in intensive beds', 'https://www.fao.org/4/x3996e/x3996e39.htm'),
    'ipm': ('FAO: Putting integrated pest management into practice', 'https://www.fao.org/agriculture/crops/thematic-sitemap/theme/spi/scpi-home/managing-ecosystems/integrated-pest-management/ipm-how/en/'),
    'daipm': ('DA-SAAD: Safe and sustainable crop pest management', 'https://saad.da.gov.ph/saad-cagval-promotes-safe-sustainable-farming-among-pfa-members/'),
    'mulch': ('FAO: Soil organic cover', 'https://www.fao.org/conservation-agriculture/in-practice/soil-organic-cover/en/'),
    'soil': ('DA-BSWM: Fertilizer recommendations from soil tests', 'https://www.bswm.da.gov.ph/download/bswm-fertilizer-recommendation/'),
    'soiltest': ('DA-BSWM: Rapid soil testing', 'https://www.bswm.da.gov.ph/wp-content/uploads/RST-Brochure.pdf'),
    'soilhealth': ('DA-BSWM: National Soil Health Program', 'https://nshp.bswm.da.gov.ph/'),
    'organic': ('FAO: Managing soil organic matter', 'https://www.fao.org/4/a0100e/a0100e07.htm'),
    'compost': ('FAO: Plant nutrition in home gardens', 'https://www.fao.org/4/x3996e/x3996e29.htm'),
    'riceapps': ('DA-PhilRice: Rice crop management tools', 'https://www.philrice.gov.ph/rice-apps/'),
    'pagasa': ('DOST-PAGASA: Agroclimatic review and outlook', 'https://pagasa.dost.gov.ph/agri-weather/monthly-agroclimatic-review-and-outlook'),
    'storm': ('Department of Agriculture: Farm early warning and early harvest', 'https://www.da.gov.ph/early-warning-mechanism-saves-p12b-agri-crops/'),
    'climate': ('DA-AMIA: Climate resilient crop management', 'https://amia.da.gov.ph/wp-content/uploads/2024/12/CRVA-Report_Batanes_Garlic_Onion_Sweet-Potato.pdf'),
    'weeds': ('IRRI: Integrated weed control and herbicides', 'https://www.knowledgebank.irri.org/step-by-step-production/growth/weed-management/herbicides'),
    'drying': ('DA-PHilMech: Grain drying', 'https://rcef.philmech.gov.ph/?action=grainDrying&page=knowledgeBank'),
    'storage': ('FAO: Grain storage', 'https://www.fao.org/4/s1250e/S1250E0w.htm'),
    'fresh': ('FAO: Harvesting and preparing fresh produce for market', 'https://www.fao.org/4/x5403e/x5403e03.htm'),
    'packing': ('FAO: Harvesting and handling fruits and vegetables', 'https://www.fao.org/4/y4893e/y4893e04.htm'),
    'animal': ('FAO: Healthy animals, happy farmers', 'https://www.fao.org/newsroom/story/Healthy-animals-happy-farmers%21/en'),
    'biosecurity': ('FAO: Biosecurity in animal value chains', 'https://www.fao.org/animal-health/areas-of-work/biosecurity/en'),
    'birdflu': ('DA-ATI: A farmer\'s guide to bird flu', 'https://ati2.da.gov.ph/ati-2/content/sites/default/files/2023-07/Bird%20Flu%20Leaflet_0.pdf'),
    'herd': ('FAO: Animal health and dairy farming good practices', 'https://www.fao.org/4/Y5224E/y5224e05.htm'),
}

ARTICLES = []


def add(slug, category, title, question, answer, keywords, source):
    source_name, source_url = SOURCES[source]
    ARTICLES.append({
        'id': f'agrixa-faq-{slug}', 'title': title, 'question': question,
        'answer': answer, 'category': category,
        'keywords': [word.strip() for word in keywords.split(',')],
        'sourceName': source_name, 'sourceUrl': source_url,
    })


# Rice: 12 entries.
add('rice-yellow-leaves', 'Rice', 'Yellowing rice leaves',
    'Why are my rice leaves turning yellow?',
    'Nitrogen shortage can make older rice leaves pale, but yellowing alone does not identify the cause. Check which leaves are affected, field water, roots, and pest damage. Ask your LGU technician to assess the crop before changing fertilizer rates; apply nutrients according to the field recommendation.',
    'rice, palay, yellow, yellowing, dilaw, naninilaw, dahon, nitrogen', 'nitrogen')
add('rice-variety', 'Rice', 'Choosing a rice variety',
    'Which rice variety should I plant?',
    'Choose a locally adapted variety suited to your water supply, planting season, pest pressure, and buyers. Compare its maturity with neighboring fields and expected irrigation availability. Ask your agriculture office which certified varieties perform well in your area before buying seed.',
    'rice, palay, variety, barayti, binhi, certified, planting', 'variety')
add('rice-seed-quality', 'Rice', 'Recognizing good rice seed',
    'How do I choose good quality rice seeds?',
    'Use clean, healthy seed from a reliable source. Look for a uniform seed lot with full grains and little contamination by weeds, other varieties, or damaged seed. Check the seed label and germination information before planting; poor seed causes uneven establishment and extra replanting.',
    'rice, palay, seed, seeds, binhi, germination, certified, quality', 'seed')
add('rice-land-leveling', 'Rice', 'Leveling the rice field',
    'Why should my rice field be level before planting?',
    'A level field distributes irrigation more evenly and helps control weeds. Prepare and level the soil before crop establishment, and repair bunds that leak. Check for high spots that dry quickly and low spots where seedlings may remain submerged.',
    'rice, palay, lupa, leveling, land preparation, bunds, pilapil', 'land')
add('rice-healthy-seedlings', 'Rice', 'Preparing healthy rice seedlings',
    'How can I prepare rice seedlings for transplanting?',
    'Start with healthy seed in a well prepared nursery with reliable water. Keep seedlings free of weeds and moisture stress, and handle roots carefully when lifting them. Seedling age and nursery method should match the variety and transplanting system recommended by your technician.',
    'rice, palay, punla, seedlings, nursery, transplanting, lipat tanim', 'nursery')
add('rice-uneven-stand', 'Rice', 'Checking uneven rice growth',
    'Why is my rice crop growing unevenly?',
    'Compare affected and healthy patches for seedling establishment, field level, water depth, weeds, and nutrient supply. Record where the problem started and the crop age. Use these observations with the PalayCheck checks and an LGU field assessment to identify the limiting factor.',
    'rice, palay, uneven, patches, stunted, growth, bansot', 'palay')
add('rice-snails', 'Rice', 'Protecting young rice from golden apple snails',
    'How can I reduce golden apple snail damage in my rice field?',
    'Young rice is vulnerable to golden apple snails that cut stems near the base. Collect snails and pink egg clusters during land preparation and establishment, and use screens at water entry points. Coordinate collection with nearby farmers because snails move through irrigation channels.',
    'rice, palay, kuhol, snail, snails, golden apple, pink eggs', 'snail')
add('rice-sheath-blight', 'Rice', 'Recognizing possible rice sheath blight',
    'What should I do about gray patches on rice leaf sheaths?',
    'Sheath blight can begin as water-soaked or gray-green lesions near the water line. Dense growth and excessive nitrogen favor its spread. Photograph the affected sheaths and seek confirmation from your technician; use balanced fertilizer, appropriate spacing, and weed management to reduce favorable conditions.',
    'rice, palay, sheath blight, lesions, gray, patches, sakit', 'sheath')
add('rice-zinc', 'Rice', 'Stunted rice with brown leaf spots',
    'Could zinc deficiency be causing stunted rice and brown spots?',
    'Zinc deficiency can cause poor establishment and dusty brown spots a few weeks after transplanting, but other disorders can look similar. Ask for a field or nutrient assessment before applying zinc. Manage drainage and nutrient balance according to the confirmed cause.',
    'rice, palay, zinc, brown spots, stunted, bansot, nutrient deficiency', 'zinc')
add('rice-curled-leaves', 'Rice', 'Checking curled rice leaves',
    'Why are young rice leaves curling or rolling?',
    'Curled leaves can reflect moisture stress or rice thrips feeding. Check soil moisture and look inside rolled leaves for tiny insects and silvery feeding marks. Have your technician confirm the cause before treatment, and protect beneficial insects when choosing a management action.',
    'rice, palay, thrips, curling, rolling, curled leaves, drought', 'thrips')
add('rice-crop-records', 'Rice', 'Keeping useful rice crop records',
    'What should I record during the rice season?',
    'Record variety, sowing and transplanting dates, fertilizer applications, irrigation, pest observations, harvest, and costs. Compare crop performance with PalayCheck targets and discuss the results with your technician. The record helps explain what worked and what to adjust next season.',
    'rice, palay, records, notebook, gastos, ani, palaycheck', 'palay')
add('rice-water-stress', 'Rice', 'Avoiding rice water stress at flowering',
    'Why is water supply important when rice is flowering?',
    'Rice is especially sensitive to water stress around flowering. Check irrigation availability before this stage and avoid prolonged drying or excessive submergence. Coordinate water delivery with your irrigators association and follow a field-specific water schedule.',
    'rice, palay, flowering, pamumulaklak, irrigation, water stress, patubig', 'palay')

# Corn: 8 entries.
add('corn-variety', 'Corn', 'Selecting corn seed for your farm',
    'How do I choose a corn variety or hybrid?',
    'Match corn seed to local climate, expected maturity, pest resistance, and market use. Buy high quality seed from a reliable supplier and check the label. Discuss suitable varieties with your agriculture technician and intended buyer before planting.',
    'corn, mais, maize, hybrid, variety, seed, binhi', 'corn')
add('corn-planting-time', 'Corn', 'Planning corn planting around moisture',
    'When should I plant corn?',
    'Plant when soil moisture is sufficient for germination and the expected season can support crop growth. Use the local rainfall outlook and irrigation schedule rather than calendar dates alone. Coordinate planting with nearby growers where feasible to reduce continuous pest carryover.',
    'corn, mais, maize, planting, season, moisture, tanim', 'corn')
add('corn-land-preparation', 'Corn', 'Preparing land for corn',
    'What should I check before sowing corn?',
    'Prepare a seedbed that allows uniform seed placement and drainage, working when soil moisture is suitable. Follow the spacing and seed rate recommended for your variety and planting equipment. Uneven placement and a poor seedbed can lead to gaps and weak establishment.',
    'corn, mais, maize, soil, seedbed, spacing, land preparation', 'corn')
add('corn-early-weeds', 'Corn', 'Controlling weeds in young corn',
    'How can I keep weeds from competing with young corn?',
    'Inspect the field early and remove weeds while they are small. Use timely, shallow cultivation appropriate to the crop stage, avoiding root damage. Combine field preparation and manual or mechanical control; ask your technician about any necessary herbicide and its label restrictions.',
    'corn, mais, weeds, damo, cultivation, young corn, herbicide', 'corn')
add('corn-armyworm', 'Corn', 'Responding to suspected fall armyworm',
    'What should I do if caterpillars are damaging the corn whorl?',
    'Inspect several parts of the field and record plants with fresh feeding damage, larvae, and droppings in the whorl. Send clear photos and crop age to your LGU technician or regional crop protection staff for identification. Select controls using scouting results and current local recommendations.',
    'corn, mais, fall armyworm, uod, caterpillar, whorl, holes', 'faw')
add('corn-earworm', 'Corn', 'Reducing corn earworm problems',
    'How can I reduce caterpillar damage to corn ears?',
    'Inspect ears and confirm the pest with a technician. Reduce carryover through field sanitation and coordinated planting, and choose suitable resistant varieties where available. If a pesticide is needed, use only a product registered for that crop and pest, following its label and harvest interval.',
    'corn, mais, earworm, uod, corn ears, caterpillar, damaged kernels', 'earworm')
add('corn-beneficial-insects', 'Corn', 'Protecting beneficial insects in corn',
    'Are all insects in my corn field harmful?',
    'No. Natural enemies such as earwigs and parasitoids can help suppress crop pests. Learn to distinguish pests from beneficial insects during scouting. Avoid unnecessary spraying and ask your technician about locally appropriate biological controls before choosing a treatment.',
    'corn, mais, earwigs, trichogramma, beneficial insects, natural enemies', 'cornpest')
add('corn-pest-monitoring', 'Corn', 'Checking corn for pests regularly',
    'How should I monitor corn pests before deciding to spray?',
    'Walk through different sections of the field and look for pests, fresh damage, and natural enemies. Note the crop stage and whether damage is increasing. Share the observations with your technician so a control decision reflects actual field conditions.',
    'corn, mais, scouting, monitoring, pest, spray, peste', 'cornpest')

# Vegetables: 10 entries.
add('vegetable-site', 'Vegetables', 'Choosing a vegetable plot',
    'Where should I establish a vegetable garden?',
    'Choose a site with adequate water supply and drainage, and plan beds that are easy to reach for weeding and harvest. Select vegetables suited to your local conditions and household or market needs. Avoid areas where standing water repeatedly damages roots.',
    'vegetables, gulay, garden, plot, drainage, water, site', 'vegetable')
add('vegetable-raised-beds', 'Vegetables', 'Using beds to manage vegetable drainage',
    'How can I reduce waterlogging in my vegetable plot?',
    'Prepare beds and drainage paths so excess water can leave the root zone. Keep outlets clear and observe where rainwater collects. Bed design should suit the site; ask your technician for help where flooding is frequent or drainage affects neighboring land.',
    'vegetables, gulay, raised beds, drainage, waterlogging, baha', 'vegetable')
add('vegetable-mulch', 'Vegetables', 'Mulching vegetable beds',
    'How does mulch help vegetables during dry weather?',
    'A cover of suitable plant residues helps reduce moisture loss, protects the soil surface, and suppresses weeds. Apply mulch so emerging seedlings are not buried and keep checking soil moisture below it. Choose clean material and manage it alongside irrigation and field sanitation.',
    'vegetables, gulay, mulch, straw, dayami, moisture, dry season', 'mulch')
add('vegetable-successive-planting', 'Vegetables', 'Planning successive vegetable crops',
    'How can I keep a small vegetable garden productive?',
    'Divide the garden into manageable beds and plan what follows each harvest. Choose a mix of locally suitable vegetables that your household uses or buyers need. Prepare the next bed with adequate nutrients and water so production does not depend on one crop alone.',
    'vegetables, gulay, garden, succession, planting plan, crop diversity', 'vegetable')
add('vegetable-crop-rotation', 'Vegetables', 'Rotating vegetable crops',
    'Why should I rotate the vegetables planted in one plot?',
    'Repeatedly planting the same host crop can allow some pests and diseases to build up. Plan a rotation with crops that do not share the main pest problem. Ask your technician to help choose the sequence; rotation works best with sanitation and regular observation.',
    'vegetables, gulay, rotation, crop rotation, soil disease, planting', 'ipm')
add('vegetable-aphids', 'Vegetables', 'Checking vegetables for aphids',
    'What should I do about small insects clustered on vegetable shoots?',
    'Inspect shoots and leaf undersides and photograph the insects for identification; aphids are a common vegetable pest. Check nearby plants and beneficial insects before deciding on control. Use scouting and locally recommended integrated management rather than spraying every insect you see.',
    'vegetables, gulay, aphids, dapulak, shoots, insects, curled leaves', 'cornpest')
add('vegetable-fruit-borers', 'Vegetables', 'Responding to vegetable fruit borers',
    'Why do my vegetables have holes and caterpillars inside the fruit?',
    'Fruit borers can cause this damage, but the pest should be identified before treatment. Inspect fruits regularly, record the affected crop and growth stage, and ask your technician about sanitation and biological controls. Coordinate pest management with neighboring growers where practical.',
    'vegetables, gulay, fruit borer, talong, tomato, kamatis, holes, uod', 'daipm')
add('vegetable-clean-field', 'Vegetables', 'Keeping a vegetable plot clean',
    'How does field sanitation help protect vegetables?',
    'Crop residues and neglected host plants can carry pests between plantings. Inspect the plot, manage weeds, and ask your technician how to handle affected plant material for the identified problem. Combine sanitation with rotation and monitoring instead of relying on one control method.',
    'vegetables, gulay, sanitation, weeds, infected plants, pest prevention', 'daipm')
add('vegetable-onion-wet-season', 'Vegetables', 'Protecting onions from waterlogging',
    'How can I protect onions during heavy rain?',
    'Use well drained beds or furrows and keep drainage channels clear. Mulch can reduce soil splash and protect the soil surface. Adapt planting schedules and field layout to local flood risk with your technician; onion roots should not remain in stagnant water.',
    'onion, sibuyas, vegetables, gulay, rain, waterlogging, drainage', 'climate')
add('vegetable-nutrient-plan', 'Vegetables', 'Feeding vegetables according to need',
    'How do I choose fertilizer for my vegetables?',
    'Use soil test results and a recommendation for the specific vegetable and growth stage. Well managed organic materials can support soil fertility, while additional fertilizer should address the crop\'s remaining needs. Avoid applying the same amount to every crop without checking the soil.',
    'vegetables, gulay, fertilizer, abono, nutrients, compost, soil', 'compost')

# Soil and fertilizer: 8 entries.
add('soil-test-benefit', 'Soil & Fertilizer', 'Testing soil before buying fertilizer',
    'Why should I have my soil tested?',
    'A soil test helps identify which nutrients your field can supply and supports a recommendation for the right fertilizer, amount, and timing. Ask your agriculture office about soil testing and take the result with you when planning inputs for the next crop.',
    'soil test, lupa, fertilizer, abono, nutrients, testing', 'soil')
add('soil-sample-help', 'Soil & Fertilizer', 'Getting a useful soil sample',
    'How do I collect soil for laboratory testing?',
    'Ask the receiving laboratory or LGU technician for its sampling instructions before collecting. Provide the field location, crop, and recent fertilizer history, and label samples clearly. Following the laboratory\'s collection and preparation procedure helps make the result useful for that field.',
    'soil, lupa, sample, sampling, laboratory, soil test, label', 'soiltest')
add('soil-ph', 'Soil & Fertilizer', 'Understanding soil pH',
    'How can I find out whether my soil is acidic or alkaline?',
    'Request a soil pH test through your agriculture office or a soil laboratory. BSWM soil testing includes pH and key nutrient measurements. Let a technician interpret the result for your crop before choosing amendments; leaf color alone cannot establish soil acidity.',
    'soil, lupa, pH, acidic, acidity, alkaline, lime, apog', 'soiltest')
add('soil-balanced-fertilization', 'Soil & Fertilizer', 'Using balanced fertilization',
    'Can I combine organic and inorganic fertilizer?',
    'Yes, a field-specific plan can combine organic materials with mineral fertilizer to support soil health and meet crop needs. Their contributions and application timing differ. Use soil results and your technician\'s recommendation to avoid nutrient shortages or unnecessary applications.',
    'soil, fertilizer, abono, organic, inorganic, balanced, compost', 'soilhealth')
add('soil-organic-matter', 'Soil & Fertilizer', 'Building soil organic matter',
    'How can I improve soil organic matter?',
    'Return suitable crop residues and use well managed compost or other appropriate organic materials. Protect the soil surface with cover where practical and reduce avoidable erosion. Improvement takes repeated management over seasons; continue monitoring crop nutrition rather than expecting one application to solve every deficiency.',
    'soil, lupa, organic matter, compost, residues, soil health', 'organic')
add('soil-erosion-cover', 'Soil & Fertilizer', 'Keeping topsoil from washing away',
    'How can I reduce soil erosion on exposed ground?',
    'Keep soil covered with suitable vegetation or crop residues when practical. Cover reduces raindrop impact and helps water enter the soil. For sloping land, have a technician help plan runoff control and crop layout appropriate to the slope and local rainfall.',
    'soil, erosion, topsoil, runoff, slope, mulch, lupa', 'organic')
add('fertilizer-field-rate', 'Soil & Fertilizer', 'Choosing the correct fertilizer amount',
    'How many bags of fertilizer should I apply per hectare?',
    'There is no single bag rate that fits every field. The recommendation depends on soil test results, crop, and fertilizer formulation. Ask your technician to calculate the amount and timing for your field using the BSWM recommendation or another locally validated tool.',
    'fertilizer, abono, bags, hectare, rate, amount, soil test', 'soil')
add('rice-fertilizer-tool', 'Soil & Fertilizer', 'Getting a field-specific rice fertilizer plan',
    'Where can I get guidance on rice fertilizer timing and amount?',
    'Ask your agriculture technician about PhilRice crop management tools such as Rice Crop Manager. Provide accurate information about your field and crop so the recommendation can address fertilizer type, amount, and timing. Keep a record of the applications you actually make.',
    'rice, palay, fertilizer, abono, Rice Crop Manager, RCM, timing', 'riceapps')

# Water and weather: 7 entries.
add('water-awd', 'Water & Weather', 'Understanding alternate wetting and drying',
    'Can alternate wetting and drying save water in irrigated rice?',
    'Alternate wetting and drying allows controlled drying between irrigations using a field water tube to monitor water level. It requires suitable field conditions and reliable control of irrigation. Ask your technician to demonstrate safe thresholds and the stages when rice must be kept adequately watered.',
    'water, patubig, rice, palay, AWD, alternate wetting drying, irrigation', 'awd')
add('water-awd-monitoring', 'Water & Weather', 'Monitoring water before irrigating rice',
    'Can I use only a fixed calendar to irrigate under AWD?',
    'Use the field water level and crop stage, not a calendar alone. Soil, weather, and seepage affect how quickly the field dries. Have a technician show you how to install and read a water tube and adjust irrigation around sensitive growth stages.',
    'water, irrigation, AWD, water tube, rice, palay, monitoring', 'awd')
add('weather-forecast', 'Water & Weather', 'Using official weather information for farm work',
    'Where should I check weather before planting or harvesting?',
    'Check the latest PAGASA forecasts, warnings, and agricultural outlooks, then discuss local conditions with your agriculture office. Use short-range forecasts for immediate field work and seasonal outlooks for planning. Recheck updates because conditions and warnings can change.',
    'weather, panahon, forecast, PAGASA, ulan, planting, harvest', 'pagasa')
add('weather-dry-season-plan', 'Water & Weather', 'Planning crops when water may be limited',
    'How should I plan planting when a dry period is expected?',
    'Compare the current PAGASA outlook with your actual irrigation and stored water supply. Discuss crop choice, planting area, and timing with your technician before committing inputs. Continue checking updates; a regional outlook does not guarantee rainfall for an individual field.',
    'weather, drought, tagtuyot, dry season, water shortage, El Nino', 'pagasa')
add('weather-storm-harvest', 'Water & Weather', 'Preparing a harvest before a typhoon',
    'Should I harvest before a typhoon arrives?',
    'Check official warnings and ask your technician whether the crop is mature enough for an early harvest. Arrange labor, transport, and drying capacity while conditions are still safe. Follow local emergency instructions and stop field work when weather makes it unsafe.',
    'typhoon, bagyo, storm, harvest, ani, warning, weather', 'storm')
add('weather-drainage-check', 'Water & Weather', 'Preparing vegetable drainage before heavy rain',
    'What should I prepare before heavy rain reaches my vegetable field?',
    'Inspect raised beds, furrows, and drainage outlets before rain starts. Clear obstructions safely and protect exposed soil with suitable cover. Use the local flood history when deciding where to plant, and seek technical help for fields with recurring waterlogging.',
    'rain, ulan, vegetables, gulay, drainage, flood, baha', 'climate')
add('water-mulch-conservation', 'Water & Weather', 'Conserving moisture between irrigations',
    'How can I slow soil drying in an upland crop plot?',
    'Maintain suitable soil cover with crop residues or an appropriate cover crop where it fits the production system. Cover can reduce evaporation and improve water infiltration. Check moisture in the root zone and adjust irrigation to crop needs rather than judging the surface alone.',
    'water, moisture, irrigation, dry soil, mulch, upland, patubig', 'mulch')

# Pest management: 8 entries.
add('pest-ipm-basics', 'Pest Management', 'Understanding integrated pest management',
    'What is integrated pest management or IPM?',
    'IPM combines crop observation, prevention, and suitable controls to keep pest damage manageable. It uses practices such as crop rotation, healthy planting material, sanitation, and protection of natural enemies. A pesticide decision should follow identification and field assessment rather than routine calendar spraying.',
    'pest, peste, IPM, integrated pest management, spray, prevention', 'ipm')
add('pest-identification', 'Pest Management', 'Identifying the cause before treating crop damage',
    'Should I spray immediately when I see damaged leaves?',
    'First identify the pest or other cause and check how much fresh damage is occurring. Look for natural enemies as well as pests. Share photos and crop details with a technician so management targets the actual problem and avoids unnecessary applications.',
    'pest, peste, damaged leaves, spray, identification, diagnosis', 'ipm')
add('pest-beneficials', 'Pest Management', 'Recognizing natural pest control',
    'Why should I protect beneficial insects?',
    'Predators and parasitoids can reduce pest populations naturally. Learn which organisms are beneficial in your crop before selecting a control. Avoid indiscriminate spraying and discuss biological control options with your local technician.',
    'pest, beneficial insects, predators, parasitoids, biological control', 'ipm')
add('pest-synchronized-planting', 'Pest Management', 'Coordinating planting with nearby farms',
    'How can synchronized planting help with pest management?',
    'Coordinating planting periods can reduce a continuous supply of suitable host crops for some pests. Discuss a practical schedule with neighboring growers and your technician, taking water and labor availability into account. Combine it with monitoring and field sanitation.',
    'pest, synchronized planting, sabayang tanim, community, crop calendar', 'daipm')
add('pest-biological-control', 'Pest Management', 'Getting help with biological pest controls',
    'Can I use Trichogramma or other natural enemies on my farm?',
    'Biological controls must match the pest and crop stage. Ask your LGU technician or crop protection office whether suitable agents are available and how to release and protect them. Avoid improvising release rates or combining them with incompatible sprays.',
    'pest, biological control, Trichogramma, parasitoid, natural enemies', 'cornpest')
add('pest-rice-weed-methods', 'Pest Management', 'Combining methods to manage rice weeds',
    'Is herbicide the only way to control rice weeds?',
    'No. Combine suitable land preparation, stale seedbed practices where applicable, and manual or mechanical weeding with other recommended methods. If herbicide is needed, identify the weeds and follow the registered product label for crop stage and application conditions.',
    'rice, palay, weeds, damo, herbicide, manual weeding, stale seedbed', 'weeds')
add('pest-pesticide-label', 'Pest Management', 'Following the crop and pest on the pesticide label',
    'Can I use any pesticide sold for a similar crop pest?',
    'Use a pesticide only when appropriate for the identified problem and registered for the intended crop and pest. Follow the label for dose, protective equipment, application conditions, re-entry, and harvest interval. Ask your technician or supplier to clarify any unreadable or missing label.',
    'pesticide, label, FPA, dose, safety, harvest interval, spray', 'earworm')
add('pest-snail-community', 'Pest Management', 'Managing snails along irrigation routes',
    'Why do golden apple snails return after I collect them?',
    'Snails can enter through irrigation canals and floodwater. Check water entry points, use suitable screens, and coordinate snail and egg collection with neighboring farms. Continue monitoring during crop establishment, when rice seedlings are especially vulnerable.',
    'snails, kuhol, golden apple, irrigation, canals, eggs, rice', 'snail')

# Postharvest: 6 entries.
add('postharvest-palay-drying', 'Postharvest', 'Drying palay promptly after harvest',
    'Why should freshly harvested palay be dried promptly?',
    'Wet grain deteriorates quickly and can develop mold, discoloration, and heat damage. Arrange drying capacity before harvest and begin drying as soon as possible. Use an appropriate drying method and check moisture before putting grain into storage.',
    'postharvest, palay, rice, drying, pagpapatuyo, wet grain, mold', 'drying')
add('postharvest-moisture', 'Postharvest', 'Checking grain moisture before storage',
    'Can I store grain just because it feels dry?',
    'Surface feel is not a reliable moisture measurement. Have representative samples checked with a suitable moisture meter and confirm the target for the crop and intended storage period. Uneven or incomplete drying can cause losses even in a good storage facility.',
    'grain, palay, corn, mais, moisture meter, drying, storage', 'drying')
add('postharvest-store-preparation', 'Postharvest', 'Preparing a clean grain store',
    'How should I prepare a room for stored palay or corn?',
    'Clean out old grain and debris, repair leaks, and protect the store from rodents, birds, and insects. Use clean storage containers and keep grain dry. Inspect the store regularly so moisture entry or pest activity is addressed before losses spread.',
    'storage, bodega, grain, rice, palay, corn, mais, rodents', 'storage')
add('postharvest-produce-shade', 'Postharvest', 'Keeping harvested vegetables out of the sun',
    'How can I slow wilting after harvesting vegetables?',
    'Move harvested produce into shade promptly and reduce delays before transport or appropriate cooling. Use clean, smooth containers and handle produce gently. Where practical, harvest during cooler conditions to reduce heat carried into the handling area.',
    'vegetables, gulay, harvest, wilting, shade, transport, freshness', 'fresh')
add('postharvest-bruising', 'Postharvest', 'Preventing bruises during packing and transport',
    'Why do my fruits and vegetables get damaged on the way to market?',
    'Dropping produce, rough container surfaces, overfilling, and crushing stacked packages can cause damage. Train handlers to place produce gently and use strong, suitable containers. Keep loads stable and avoid packing beyond a container\'s capacity.',
    'postharvest, vegetables, fruit, bruises, packing, crates, transport', 'packing')
add('postharvest-harvest-containers', 'Postharvest', 'Choosing containers for fresh produce',
    'What containers should I use when harvesting vegetables?',
    'Use clean containers with smooth inner surfaces that will not cut or scrape produce. Ventilated, stackable containers can help handling when suited to the crop. Empty picking containers carefully and avoid throwing produce into larger bins.',
    'vegetables, gulay, harvesting, containers, crates, baskets, handling', 'fresh')

# Livestock: 7 entries.
add('livestock-sick-animal', 'Livestock', 'Separating a sick farm animal',
    'What should I do first when a farm animal looks sick?',
    'Separate the affected animal from healthy animals where this can be done safely, and contact your veterinarian or local animal health office. Record the signs and when they began. A correct diagnosis is needed before choosing medicine.',
    'livestock, hayop, sick, sakit, isolation, veterinarian, treatment', 'animal')
add('livestock-clean-water', 'Livestock', 'Keeping animal drinking water clean',
    'How can I improve drinking water hygiene for livestock?',
    'Provide clean drinking water and keep water containers clean. Protect water and feed from contamination by pests and other animals. Check supplies during daily feeding so dirty or interrupted water does not go unnoticed.',
    'livestock, hayop, water, tubig, drinkers, hygiene, feeding', 'animal')
add('livestock-feed-storage', 'Livestock', 'Storing animal feed properly',
    'How should I store feed for chickens, pigs, or other livestock?',
    'Keep feed dry and protect it from rodents, birds, insects, and other contamination. Inspect the storage area and feed condition regularly. Good storage and adequate nutrition help prevent illness and reduce avoidable losses.',
    'livestock, poultry, chicken, pig, feeds, pakain, storage, rodents', 'animal')
add('livestock-vaccination', 'Livestock', 'Planning farm animal vaccination',
    'Which vaccines should I give my farm animals?',
    'Ask a veterinarian or local animal health office to prepare a vaccination plan for the species, age, and local disease risks. Keep vaccination records and follow professional handling instructions. Vaccination supports prevention alongside good hygiene and nutrition.',
    'livestock, vaccine, vaccination, bakuna, chicken, pig, cattle', 'animal')
add('livestock-biosecurity', 'Livestock', 'Reducing disease entry onto the farm',
    'What does biosecurity mean for a small livestock farm?',
    'Biosecurity reduces the chance of disease entering or spreading. Keep animal areas hygienic, separate species where appropriate, protect them from wild animals and insects, and manage waste properly. Ask your local veterinary team for a practical plan suited to your farm.',
    'livestock, biosecurity, farm hygiene, disease prevention, hayop', 'biosecurity')
add('livestock-unusual-poultry-deaths', 'Livestock', 'Reporting unusual poultry illness or deaths',
    'What should I do if several chickens become sick or die suddenly?',
    'Report unusual illness or deaths promptly to the nearest agriculture or veterinary office. Restrict unnecessary contact with affected birds and follow the veterinary team\'s instructions for handling birds and carcasses. Do not assume the cause without assessment.',
    'poultry, chicken, manok, deaths, bird flu, avian influenza, report', 'birdflu')
add('livestock-treatment-records', 'Livestock', 'Recording animal treatments and withdrawal periods',
    'What information should I record when an animal receives medicine?',
    'Identify the treated animal and record the medicine, treatment dates, and veterinary instructions, including any withdrawal period for meat or milk. Keep products from treated animals separate as required. Ask the veterinarian before marketing animal products if the withdrawal timing is unclear.',
    'livestock, medicine, treatment, records, withdrawal period, milk, meat', 'herd')


def validate():
    if len(ARTICLES) < 60:
        raise ValueError('At least 60 articles are required')
    for key in ('id', 'title', 'question'):
        if len({article[key].casefold() for article in ARTICLES}) != len(ARTICLES):
            raise ValueError(f'Duplicate {key}')
    for article in ARTICLES:
        if any(not article[key] for key in ('title', 'question', 'answer', 'category', 'keywords', 'sourceName')):
            raise ValueError(f'Missing required content in {article["id"]}')
        url = urlparse(article['sourceUrl'])
        if url.scheme != 'https' or not url.netloc:
            raise ValueError(f'Invalid source URL in {article["id"]}')
    print(f'Checked {len(ARTICLES)} unique sourced FAQs; authorized review is still required')
    for category, count in sorted(Counter(a['category'] for a in ARTICLES).items()):
        print(f'  {category}: {count}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Create missing entries in configured Firestore')
    args = parser.parse_args()
    validate()
    if not args.apply:
        print('Structure check only. Pass --apply to submit the articles for LGU validation.')
        return

    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from core.firebase import db

    collection = db.collection('knowledge_entries')
    existing_ids = {doc.id for doc in collection.stream()}
    missing = [article for article in ARTICLES if article['id'] not in existing_ids]
    now = datetime.now(timezone.utc).isoformat()
    if missing:
        batch = db.batch()
        for article in missing:
            data = {key: value for key, value in article.items() if key != 'id'}
            data.update(isPublished=False, createdBy='system:knowledge-seed',
                        createdAt=now, updatedAt=now, seedVersion=1,
                        validationStatus='pending', submittedAt=now)
            batch.create(collection.document(article['id']), data)
        batch.commit()

    # Older imports still require an authorized review. A seed operation or
    # a source link alone cannot certify agricultural advice.
    backfilled = 0
    for article in ARTICLES:
        ref = collection.document(article['id'])
        snapshot = ref.get()
        if not snapshot.exists:
            continue
        current = snapshot.to_dict()
        updates = {}
        if not current.get('sourceName'):
            updates['sourceName'] = article['sourceName']
        if not current.get('sourceUrl'):
            updates['sourceUrl'] = article['sourceUrl']
        if (not current.get('validationStatus')
                or current.get('validatedBy') == 'system:knowledge-seed'
                or updates):
            updates.update(
                validationStatus='pending', isPublished=False, submittedAt=now,
                validatedBy=None, validatedByName=None, validatedAt=None,
                validatedByRole=None, validationNote=None, updatedAt=now,
            )
        if updates:
            ref.update(updates)
            backfilled += 1

    saved = {doc.id: doc.to_dict() for doc in collection.stream()}
    seeded = [saved[article['id']] for article in ARTICLES]
    published = sum(entry.get('isPublished') is True for entry in seeded)
    print(f'Created: {len(missing)}; metadata backfilled: {backfilled}; existing seed entries preserved: {len(ARTICLES) - len(missing)}')
    print(f'Live repository total: {len(saved)}; seeded FAQs: {len(seeded)}; published seeded FAQs: {published}')
    if any(saved[article['id']].get('validationStatus') != 'pending'
           or saved[article['id']].get('isPublished') is not False for article in missing):
        raise RuntimeError('Pending-validation verification failed')


if __name__ == '__main__':
    main()
