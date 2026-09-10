ALTER TABLE public.zones
  ADD COLUMN IF NOT EXISTS ward_number integer,
  ADD COLUMN IF NOT EXISTS ward_member_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS locations text NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS zones_ward_number_key ON public.zones(ward_number);

UPDATE public.profiles SET zone_id = NULL WHERE zone_id IN (
  '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002',
  '11111111-1111-4111-8111-000000000003','11111111-1111-4111-8111-000000000004',
  '11111111-1111-4111-8111-000000000005');
UPDATE public.workers SET zone_id = NULL WHERE zone_id IN (
  '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002',
  '11111111-1111-4111-8111-000000000003','11111111-1111-4111-8111-000000000004',
  '11111111-1111-4111-8111-000000000005');
DELETE FROM public.zones WHERE id IN (
  '11111111-1111-4111-8111-000000000001','11111111-1111-4111-8111-000000000002',
  '11111111-1111-4111-8111-000000000003','11111111-1111-4111-8111-000000000004',
  '11111111-1111-4111-8111-000000000005');

INSERT INTO public.zones (ward_number, name, ward_member_name, supervisor_name, locations, center_lat, center_lng)
VALUES
 (1,'Ward 01 - Throvagunta','Kotapoti Samrajyam','Kotapoti Samrajyam','Throvagunta, S.C. Colony, B.C. Colony, Vaddipalem',15.5057,80.0499),
 (2,'Ward 02 - Mukthinuthalapadu','Tellapalli Dhara Lakshmi','Tellapalli Dhara Lakshmi','Mukthinuthalapadu, Gudimellapadu, Kesavarajukunta, Chinamalleswaraswamy Colony',15.5074,80.0521),
 (3,'Ward 03 - Bilal Colony','Gondu Dhana Lakshmi','Gondu Dhana Lakshmi','Bilal Colony, Papa Colony, Ponugupati Nagar, N.T.R. Colony, Balineni Bharath Nagar, Karuna Colony',15.5091,80.0543),
 (4,'Ward 04 - Islampeta','Savitri Noojahan','Savitri Noojahan','Islampeta, Kabela Road, Islampeta North Extension, Prakasam Colony',15.5108,80.0565),
 (5,'Ward 05 - Gopalanagar North','Yendeti Padmavathi','Yendeti Padmavathi','Mahindra Nagar, Gopalanagar 1st to 4th Line Extension, Gopalanagar 1st & 2nd Line, Bhagat Singh Colony',15.5125,80.0587),
 (6,'Ward 06 - Neelampalem','Challa Trisamala Rao','Challa Trisamala Rao','Neelampalem, Gopalanagar 3rd & 4th Line, Kothapatnam Road North Side',15.5142,80.0609),
 (7,'Ward 07 - Bollinenivaripalem','Dachaala Venkata Ramanaiah','Dachaala Venkata Ramanaiah','Tangella Khasim Veedhi, Gopalanagar 5th & 6th Line, Bollinenivaripalem 1 to 3rd Lines & Cross Roads, Chakali Veedhi, Dharavari Veedhi, Kothapatnam Road North Side',15.5159,80.0631),
 (8,'Ward 08 - Thurpu Kammappalem','Sandrapat Venkata Vojha','Sandrapat Venkata Vojha','Gopalanagar 4th Line Extension to Karavadi Donka, Thurpu Kammappalem, Thurpu Christian Palem',15.5176,80.0653),
 (9,'Ward 09 - Indurthi Nagar','Venagapusa Sobhharani','Venagapusa Sobhharani','Indurthi Nagar, Puli Venkata Reddy Colony, Indira Colony-I, Rajeev Gruha Kalpa, Indiramma Colony, Koppolu North Side',15.5193,80.0675),
 (10,'Ward 10 - Koppolu South','Benguluri Narasamma','Benguluri Narasamma','Koppolu South Side, Gurram Jashuva Colony, Jayaprakash Colony, Agraharam Road East Side',15.5210,80.0697),
 (11,'Ward 11 - Railpet','Gangavarapu Pavan Kumar','Gangavarapu Pavan Kumar','Kothapatnam Road, Ananda Rao Road, Railpet, Clough Pet 1 to 6 Lines',15.5227,80.0419),
 (12,'Ward 12 - Ranguthota','Ambati Srinivas','Ambati Srinivas','Ranguthota, Chivukulavari Street, Maratipalem, Miriyalapalem',15.5244,80.0441),
 (13,'Ward 13 - Kabadipalem','Goppela Kamala','Goppela Kamala','Kabadipalem, Opp. Two Town Police Station Area, Veterinary Hospital Back Side, Railway Quarters Colony',15.5261,80.0463),
 (14,'Ward 14 - Santhapet','Mahammad Juna Khan','Mahammad Juna Khan','Chavalavari Street, Santhapet, Santhapet Extension, East Side of GNT Road',15.5278,80.0485),
 (15,'Ward 15 - Ramnagar','Chintapalli Gopikaled','Chintapalli Gopikaled','Annavarappadu 1 to 4 Lines, Ramnagar 1 to 11 Lines',15.5295,80.0507),
 (16,'Ward 16 - Agraharam Gate','Sirogama Nagabhushanam','Sirogama Nagabhushanam','Agraharam Gate Main Road, Balaji Nagar S.T. Colony, Arava Colony',15.5312,80.0529),
 (17,'Ward 17 - Ambedkar Colony','Nagam Venkata Sekhar','Nagam Venkata Sekhar','Ambedkar Colony, Pragathi Colony, Pelluru',15.5329,80.0551),
 (18,'Ward 18 - Cheruvukommupalem','Goragada Sujatha','Goragada Sujatha','Cheruvukommupalem, Vengamukkalapalem, Kotha Mamidipalem',15.5346,80.0573),
 (19,'Ward 19 - A.P.H.B. Colony','Edara Venkata Sri Babu','Edara Venkata Sri Babu','A.P.H.B. Colony, Bhagyanagar 4th Line (1 to 12 Cross Lines), Mamidipalem-I, Bank Colony, P & T Colony',15.5363,80.0595),
 (20,'Ward 20 - Bhagyanagar','Pasunleti Vijaya Lakshmi','Pasunleti Vijaya Lakshmi','Bhagyanagar, Dharavari Thota, Vijayanagar Colony-A',15.5380,80.0617),
 (21,'Ward 21 - Governor Road','Yannamala Naga Raju','Yannamala Naga Raju','Indira Colony-II, N.G.O. Home, Governor Road, Devuducheruvu Housing Board Area, Zakaraiiah Hospital, Balaji Rao Pet',15.5397,80.0639),
 (22,'Ward 22 - South Bazar','Konamsetty Rama Pulla Latha','Konamsetty Rama Pulla Latha','South Bazar, Patti Vari Street, Gandhi Road-A, Eyenguchettu Centre, Kesavaswamy Pet, Ankammapalem, Gurram Vari Street, Venugupalaswamy Temple Veedhi',15.5414,80.0661),
 (23,'Ward 23 - T.B. Road','Shaik Fathima Alias Fathima','Shaik Fathima Alias Fathima','T.B. Road, Old Market Area, Pakeer Palem, Ganugupalem, Mangalu Palem, Kota Veedhi',15.5431,80.0683),
 (24,'Ward 24 - Uracheruvu','Bedamsetty Sailaja','Bedamsetty Sailaja','Uracheruvu, Ekalavya Nagar, Vantapanivari Colony, Sundaraiah Bhavan Road, A.P.S.R.T.C. Depot Area, Filter Bed Area, Nagendra Nagar',15.5448,80.0705),
 (25,'Ward 25 - Gandhi Road-B','Vemuri Venkata Surya Narayan','Vemuri Venkata Surya Narayan','Gandhi Road-B, Ganta Palem, Parvathamma Gudi Centre, Bheemaraju Vari Veedhi',15.5465,80.0727),
 (26,'Ward 26 - Pappu Bazar','Tripparamalli Ravi Teja','Tripparamalli Ravi Teja','South Street, Pappu Bazar, Gollapallem, Opp. S.V.S. Kalyanamandapam',15.5482,80.0749),
 (27,'Ward 27 - Rajapanagal','Jada Venkatesh','Jada Venkatesh','Rajapanagal 1 to 7 Cross Roads, Kondamitta Area-A, Srigiri Towers, Seetharampuram',15.5499,80.0771),
 (28,'Ward 28 - Lawyerpet-A','Neruboyina Sanjaya','Neruboyina Sanjaya','Jammichettivari Veedhi, Opp. to Saibaba Temple Road, Lawyerpet-A, Godugupalem, Hareram Bazar, Kondaiah Bunk Road',15.5516,80.0793),
 (29,'Ward 29 - Gaddalagunta-A','Shaik Fathimabi','Shaik Fathimabi','Konjeti Bus Stand, Rajapanagal 8 to 14 Cross Roads, Edga Area, Gaddalagunta-A, Municipal Quarters',15.5533,80.0815),
 (30,'Ward 30 - Kondamitta-B','Kasimahanti Choudamma','Kasimahanti Choudamma','Kondamitta Area-B, Gaddalagunta Harizana Wada, Seetharampuram Part',15.5550,80.0837),
 (31,'Ward 31 - IDSMT Layout','Tannisu Nagyoti','Tannisu Nagyoti','IDSMT Layout, Mamidipalem-II, Viswas Nagar, C.R.P. Quarters, Vijayanagar Colony-B',15.5567,80.0859),
 (32,'Ward 32 - Rajeev Nagar Extension','Tad Krishna Latha','Tad Krishna Latha','Rajeev Nagar Extension, S.S. Tank-I, Mamidipalem-III, Gaddalagunta-B',15.5584,80.0881),
 (33,'Ward 33 - Z.P. Colony','Paddireddy Niranta Laxmi','Paddireddy Niranta Laxmi','Z.P. Colony, Vaddivani Kunta, Siva Prasad Colony, Journalist Colony, R.T.C. Colony 1 & 2, Kothadonka, Part of Kothamamidipalem',15.5601,80.0903),
 (34,'Ward 34 - Rajeev Nagar','Valanati Madhavarao','Valanati Madhavarao','Rajeev Nagar, V.I.P. Road, Sujatha Nagar, Nallurivari Street, Aarama Khetram Area, Lawyerpet Extension',15.5618,80.0925),
 (35,'Ward 35 - Lawyerpet-B','Audipudi Sri Girija Sandhya','Audipudi Sri Girija Sandhya','Lawyerpet-B, Nirmal Nagar-A, Mangamuru Road',15.5635,80.0947),
 (36,'Ward 36 - Nirmal Nagar-B','Daka Sujatha','Daka Sujatha','Nirmal Nagar-B, Rangarayudu Cheruvu, Ayyappa Swamy Temple Road, Opp. to A.P. Mines Office Road',15.5652,80.0969),
 (37,'Ward 37 - Sujatha Nagar','Chennupati Venugopal','Chennupati Venugopal','Sujatha Nagar 1 to 12 Lines, Soniya Gandhi Nagar, Gandhi Nagar, Samatha Nagar Donka-A, Chennakesava Swamy Layout Area',15.5669,80.0991),
 (38,'Ward 38 - Lakshmi Narasimha Puram','Haloga Ramesh','Haloga Ramesh','Lakshmi Narasimha Puram 1st Line Road, Arunodaya Colony, Police Quarters, Samatha Nagar Donka-B, Sujatha Nagar Donka',15.5686,80.1013),
 (39,'Ward 39 - Pernamitta North','Gali Lakshmi Koteshwaramma','Gali Lakshmi Koteshwaramma','Pernamitta Part, Indian Public School, North Side of Mangamuru Donka',15.5703,80.1035),
 (40,'Ward 40 - Pernamitta','Tella Chandrasekhar','Tella Chandrasekhar','Arunodaya Colony Part, Pernamitta, Guravareddy Colony',15.5720,80.1057),
 (41,'Ward 41 - Pernamitta Part-B','Kattineni Venkata Mahabrahmi','Kattineni Venkata Mahabrahmi','Pernamitta Part-B, Panchayat Office Main Road, Marellakuntapalli Road, Bandigunta, Razika Street',15.5737,80.1079),
 (42,'Ward 42 - Pernamitta Part-C','Nulakoti Hastanamma','Nulakoti Hastanamma','Pernamitta Part-C & Upto Municipal Corporation Limits',15.5754,80.1101),
 (43,'Ward 43 - Maruthi Nagar','Kende Swathi','Kende Swathi','Pothuraju Canal, Maruthi Nagar S.T. Colony, Shiridi Sai Nagar',15.5771,80.1123),
 (44,'Ward 44 - S.B.I. Colony','Gopireddy Gopalareddy','Gopireddy Gopalareddy','S.B.I. Colony, Sriram Colony, North Side of Kurnool Road',15.5788,80.1145),
 (45,'Ward 45 - Srinagar','Vemugesa Tumay','Vemugesa Tumay','Srinagar 1 to 4 Lines, Jayaprakash Nagar, Nagendra Nagar Main Road, Pothuraju Colony',15.5805,80.1167),
 (46,'Ward 46 - N.G.O. Colony','Gullapalli Haranamma','Gullapalli Haranamma','N.G.O. Colony Main Road, Sundaraiah Bhavan Road-B, Brundavan Nagar, Pandari Puram, A.P.S.E.B. Sub Station Back Side, Lambadi Donka',15.5822,80.1189),
 (47,'Ward 47 - Chandraiah Nagar','Vemuri Aswini','Vemuri Aswini','Pothuraju Kaluva, Chandraiah Nagar Community Hall Road, Venkataramana Nursing Home Area, Back Side of Saraswathi Sisu Mandir Road',15.5839,80.1211),
 (48,'Ward 48 - Sathyanarayanapuram 60ft','Vemuri Bhavani','Vemuri Bhavani','Sathyanarayanapuram 60 Feet Road, Venkateswara Nagar Road',15.5856,80.1233),
 (49,'Ward 49 - Guntur Road','Angirekula Guravaiah','Angirekula Guravaiah','Guntur Road, Indira Colony-III, Back Side of Vijaya Complex, Sathyanarayanapuram',15.5873,80.1255),
 (50,'Ward 50 - Nehru Nagar','Ambati Prasadorao','Ambati Prasadorao','Throvagunta Part, Wood Complex, Venkateswara Colony, Nehru Nagar',15.5890,80.1277);